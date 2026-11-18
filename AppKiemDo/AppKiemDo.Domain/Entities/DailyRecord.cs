using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Domain.Entities
{
    public class DailyRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string SheetId { get; set; } // Dữ liệu của tờ kiểm đồ nào

        public DateTime CheckDate { get; set; } // Ngày kiểm
        public string CheckerName { get; set; } // Tên người kiểm

        // Nhúng trực tiếp mảng chi tiết vào document ngày
        public List<RecordDetail> Details { get; set; } = new List<RecordDetail>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }

    public class RecordDetail
    {
        public string ItemId { get; set; }

        // Dữ liệu thô nhân viên gõ vào (giữ nguyên để đối soát)
        public string RawInput { get; set; }
        public string UnopenedInput { get; set; }

        // Kết quả sau khi hệ thống chạy công thức tính toán
        public decimal? CalculatedValue { get; set; }
        public decimal? ActualBaseWeight { get; set; }
        public string? Note { get; set; }
    }
}