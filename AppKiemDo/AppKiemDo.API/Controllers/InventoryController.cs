using AppKiemDo.API.Hubs;
using AppKiemDo.Application.DTOs;
using AppKiemDo.Application.Interfaces;
using AppKiemDo.Domain.Entities;
using AppKiemDo.Infrastructure.Data;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AppKiemDo.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InventoryController : ControllerBase
    {
        private readonly MongoDbContext _context;
        private readonly ICalculationService _calcService;
        private readonly IHubContext<InventoryHub> _hubContext; // Trạm phát sóng SignalR

        public InventoryController(MongoDbContext context, ICalculationService calcService, IHubContext<InventoryHub> hubContext)
        {
            _context = context;
            _calcService = calcService;
            _hubContext = hubContext;
        }

        [HttpPost("daily")]
        public async Task<IActionResult> SubmitDailyRecord([FromBody] SubmitDailyRecordDto request)
        {
            try
            {
                var itemsConfigs = await _context.Items
                    .Find(i => i.SheetId == request.SheetId)
                    .ToListAsync();

                var itemDict = itemsConfigs.ToDictionary(i => i.Id);

                var dailyRecord = new DailyRecord
                {
                    SheetId = request.SheetId,
                    CheckDate = request.CheckDate,
                    CheckerName = request.CheckerName,
                    Details = new List<RecordDetail>()
                };

                foreach (var input in request.Inputs)
                {
                    decimal? calculatedValue = null;

                    if (itemDict.TryGetValue(input.ItemId, out var config))
                    {
                        try
                        {
                            var weightToUse = input.ActualBaseWeight ?? config.BaseWeight;

                            // Nếu là phép chia (Type 1) mà trọng lượng <= 0 hoặc rỗng thì ngưng chia để tránh sập
                            // Thêm (int) vào trước config.CalculationType
                            if ((int)config.CalculationType == 1 && (weightToUse == null || weightToUse <= 0))
                            {
                                calculatedValue = null;
                            }
                            else
                            {
                                calculatedValue = _calcService.Calculate(
                                    input.RawInput,
                                    config.CalculationType,
                                    weightToUse,
                                    config.CustomFormula
                                );
                            }
                        }
                        catch
                        {
                            // Lỡ người dùng nhập sai cú pháp, bỏ qua lỗi tính toán của riêng món này
                            calculatedValue = null;
                        }
                    }

                    dailyRecord.Details.Add(new RecordDetail
                    {
                        ItemId = input.ItemId,
                        RawInput = input.RawInput,
                        UnopenedInput = input.UnopenedInput,
                        CalculatedValue = calculatedValue,
                        ActualBaseWeight = input.ActualBaseWeight,
                        Note = input.Note
                    });
                }

                // 🌟 CHỈNH SỬA TẠI ĐÂY: Dùng khoảng thời gian để tìm chính xác phiếu trong ngày (MongoDB rất thích điều này)
                var startOfDay = request.CheckDate.Date;
                var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

                var existingRecord = await _context.DailyRecords
                    .Find(r => r.SheetId == request.SheetId && r.CheckDate >= startOfDay && r.CheckDate <= endOfDay)
                    .FirstOrDefaultAsync();

                if (existingRecord != null)
                {
                    dailyRecord.Id = existingRecord.Id;
                    await _context.DailyRecords.ReplaceOneAsync(r => r.Id == existingRecord.Id, dailyRecord);
                }
                else
                {
                    await _context.DailyRecords.InsertOneAsync(dailyRecord);
                }

                // 🌟 THÊM request.ConnectionId VÀO CUỐI ĐỂ BÁO CHO MỌI NGƯỜI BIẾT AI VỪA LƯU
                // Thêm request.ConnectionId vào cuối để SignalR biết ai vừa lưu mà chừa ra
                await _hubContext.Clients.All.SendAsync("ReceiveInventoryUpdate", request.SheetId, request.CheckDate.ToString("yyyy-MM-dd"), request.ConnectionId);

                try
                {
                    var logs = new List<AuditLog>();
                    foreach (var input in request.Inputs)
                    {
                        var itemName = itemDict.ContainsKey(input.ItemId) ? itemDict[input.ItemId].ItemName : "Unknown";

                        logs.Add(new AuditLog
                        {
                            SheetId = request.SheetId,
                            ItemId = input.ItemId,
                            ItemName = itemName,
                            Action = "UPDATE_RECORD",
                            ChangedValue = $"Lẻ: {input.RawInput} | Nguyên: {input.UnopenedInput}",
                            PerformedBy = request.CheckerName,
                            Timestamp = DateTime.Now // Ghi nhận thời gian thực
                        });
                    }

                    if (logs.Any())
                    {
                        await _context.AuditLogs.InsertManyAsync(logs);
                    }
                }
                catch (Exception ex)
                {
                    // Bọc Try-Catch để nếu lỗi ghi log cũng không làm hỏng tiến trình lưu phiếu chính
                    Console.WriteLine("Lỗi ghi Audit Log: " + ex.Message);
                }
                return Ok(new { Message = "Lưu phiếu kiểm đồ thành công!", RecordId = dailyRecord.Id });
            }
            catch (Exception ex)
            {
                // Ép server khai ra lỗi chi tiết thay vì giấu đi
                return StatusCode(500, new
                {
                    Message = "LỖI SERVER: " + ex.Message,
                    ChiTiet = ex.StackTrace,
                    LoiSauCung = ex.InnerException?.Message
                });
            }
        }

        [HttpGet("daily")]
        public async Task<IActionResult> GetDailyRecord([FromQuery] string sheetId, [FromQuery] string date)
        {
            if (!DateTime.TryParse(date, out DateTime parsedDate))
            {
                return BadRequest("Định dạng ngày không hợp lệ.");
            }

            var startOfDay = parsedDate.Date;
            var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

            var record = await _context.DailyRecords
                .Find(r => r.SheetId == sheetId && r.CheckDate >= startOfDay && r.CheckDate <= endOfDay)
                .FirstOrDefaultAsync();

            if (record == null)
            {
                return Ok(null);
            }

            return Ok(record);
        }
        [HttpGet("audit-logs/{sheetId}")]
        public async Task<IActionResult> GetAuditLogs(string sheetId)
        {
            // Lấy 50 lịch sử mới nhất của tờ phiếu này
            var logs = await _context.AuditLogs
                .Find(l => l.SheetId == sheetId)
                .SortByDescending(l => l.Timestamp)
                .Limit(50)
                .ToListAsync();

            return Ok(logs);
        }
        [HttpGet("dashboard-stats/{sheetId}")]
        public async Task<IActionResult> GetDashboardStats(string sheetId)
        {
            var endDate = DateTime.Today;
            var startDate = endDate.AddDays(-6); // Lấy 7 ngày gần nhất

            // Lấy tất cả phiếu trong 7 ngày của tờ kiểm này
            var records = await _context.DailyRecords
                .Find(r => r.SheetId == sheetId && r.CheckDate >= startDate && r.CheckDate <= endDate.AddDays(1).AddTicks(-1))
                .ToListAsync();

            if (records.Count == 0) return Ok(new { TotalChecks = 0, TopItems = new List<object>() });

            // Gom nhóm tất cả chi tiết (Details) từ các phiếu lại
            var allDetails = records.SelectMany(r => r.Details).ToList();

            // Tính tổng số lượt kiểm đồ (tổng số record chi tiết)
            var totalChecks = allDetails.Count;

            // Tìm Top 5 mặt hàng được ghi nhận nhiều nhất (dựa trên Tổng thực tế - CalculatedValue)
            // Lưu ý: Cần lấy tên món hàng từ Database để trả về
            var itemsConfigs = await _context.Items.Find(i => i.SheetId == sheetId).ToListAsync();
            var itemDict = itemsConfigs.ToDictionary(i => i.Id);

            var topItems = allDetails
                .Where(d => d.CalculatedValue.HasValue && d.CalculatedValue.Value > 0)
                .GroupBy(d => d.ItemId)
                .Select(g => new
                {
                    ItemId = g.Key,
                    ItemName = itemDict.ContainsKey(g.Key) ? itemDict[g.Key].ItemName : "Unknown",
                    TotalCalculated = g.Sum(d => d.CalculatedValue.Value)
                })
                .OrderByDescending(x => x.TotalCalculated)
                .Take(5)
                .ToList();

            return Ok(new
            {
                TotalChecks = totalChecks,
                TopItems = topItems
            });
        }
        [HttpGet("export/{sheetId}")]
        public async Task<IActionResult> Export7Days(string sheetId)
        {
            var items = await _context.Items
                .Find(i => i.SheetId == sheetId)
                .SortBy(i => i.DisplayOrder)
                .ToListAsync();

            if (items.Count == 0) return NotFound("Không có mặt hàng nào để xuất.");

            var endDate = DateTime.Today;
            var startDate = endDate.AddDays(-6);

            var records = await _context.DailyRecords
                .Find(r => r.SheetId == sheetId && r.CheckDate >= startDate && r.CheckDate <= endDate.AddDays(1).AddTicks(-1))
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Báo Cáo 7 Ngày");

            worksheet.Cell(1, 1).Value = "Tên Hàng";
            worksheet.Range(1, 1, 2, 1).Merge();

            worksheet.Cell(1, 2).Value = "ĐVT";
            worksheet.Range(1, 2, 2, 2).Merge();

            for (int i = 0; i < 7; i++)
            {
                int startCol = 3 + (i * 2);

                worksheet.Cell(1, startCol).Value = startDate.AddDays(i).ToString("dd/MM");
                worksheet.Range(1, startCol, 1, startCol + 1).Merge();

                worksheet.Cell(2, startCol).Value = "Lẻ";
                worksheet.Cell(2, startCol + 1).Value = "Nguyên";
            }

            var headerRange = worksheet.Range(1, 1, 2, 16);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
            headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            headerRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

            int row = 3;
            foreach (var item in items)
            {
                worksheet.Cell(row, 1).Value = item.ItemName;
                worksheet.Cell(row, 2).Value = item.Unit;

                for (int i = 0; i < 7; i++)
                {
                    int colLe = 3 + (i * 2);
                    int colNguyen = 4 + (i * 2);

                    var currentDate = startDate.AddDays(i).Date;
                    var dailyRecord = records.FirstOrDefault(r => r.CheckDate.Date == currentDate);
                    var detail = dailyRecord?.Details.FirstOrDefault(d => d.ItemId == item.Id);

                    if (detail != null)
                    {
                        worksheet.Cell(row, colLe).Value = string.IsNullOrEmpty(detail.RawInput) ? "-" : detail.RawInput;
                        worksheet.Cell(row, colNguyen).Value = string.IsNullOrEmpty(detail.UnopenedInput) ? "-" : detail.UnopenedInput;
                    }
                    else
                    {
                        worksheet.Cell(row, colLe).Value = "-";
                        worksheet.Cell(row, colNguyen).Value = "-";
                    }

                    worksheet.Cell(row, colLe).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    worksheet.Cell(row, colNguyen).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }
                row++;
            }

            worksheet.Columns(1, 16).AdjustToContents();

            var dataRange = worksheet.Range(3, 1, row - 1, 16);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            var content = stream.ToArray();

            string fileName = $"BaoCaoKiemDo_{DateTime.Now:ddMMyyyy_HHmm}.xlsx";
            return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}