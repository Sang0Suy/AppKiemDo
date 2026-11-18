using AppKiemDo.Domain.Entities;
using AppKiemDo.Domain.Enums;
using AppKiemDo.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace AppKiemDo.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SheetsController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public SheetsController(MongoDbContext context)
        {
            _context = context;
        }

        // 1. API Lấy danh sách (MỞ CỬA TỰ DO CHO NHÂN VIÊN)
        [HttpGet]
        public async Task<IActionResult> GetSheets()
        {
            var sheets = await _context.SheetTemplates.Find(_ => true).SortBy(s => s.DisplayOrder).ToListAsync();
            return Ok(sheets);
        }

        // 2. API Lấy danh sách hàng hóa (MỞ CỬA TỰ DO CHO NHÂN VIÊN)
        [HttpGet("{sheetId}/items")]
        public async Task<IActionResult> GetItems(string sheetId)
        {
            var items = await _context.Items.Find(i => i.SheetId == sheetId).SortBy(i => i.DisplayOrder).ToListAsync();
            return Ok(items);
        }

        // 3. API Tạo dữ liệu mẫu (ĐÃ KHÓA: CHỈ QUẢN LÝ MỚI ĐƯỢC CHẠY)
        [Authorize(Roles = "Manager")]
        [HttpPost("seed")]
        public async Task<IActionResult> SeedData()
        {
            var hasData = await _context.SheetTemplates.Find(_ => true).AnyAsync();
            if (hasData) return BadRequest("Dữ liệu đã được tạo từ trước!");

            var sheetLanh1 = new SheetTemplate
            {
                SheetName = "KIỂM TRA HÀNG HÓA-LẠNH 1",
                DisplayOrder = 1
            };
            await _context.SheetTemplates.InsertOneAsync(sheetLanh1);

            var items = new List<Item>
            {
                new Item { SheetId = sheetLanh1.Id, ItemName = "Nước tương", Unit = "Thùng mayo", CalculationType = CalculationType.Manual, DisplayOrder = 1 },
                new Item { SheetId = sheetLanh1.Id, ItemName = "Trà HS", Unit = "Bọc", CalculationType = CalculationType.Manual, DisplayOrder = 2 },
                new Item { SheetId = sheetLanh1.Id, ItemName = "Bọc xanh 5kg", Unit = "Gr", CalculationType = CalculationType.WeightBased, BaseWeight = 5, DisplayOrder = 3 },
                new Item { SheetId = sheetLanh1.Id, ItemName = "Trân châu", Unit = "Bọc", CalculationType = CalculationType.CustomFormula, CustomFormula = "[Input] - 2", DisplayOrder = 4 }
            };

            await _context.Items.InsertManyAsync(items);

            return Ok(new { Message = "Tạo dữ liệu mẫu thành công!", SheetId = sheetLanh1.Id });
        }
    }
}