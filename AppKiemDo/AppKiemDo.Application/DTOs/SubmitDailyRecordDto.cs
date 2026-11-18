using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Application.DTOs
{
    public class SubmitDailyRecordDto
    {
        public string SheetId { get; set; } = string.Empty;
        public DateTime CheckDate { get; set; }
        public string CheckerName { get; set; } = string.Empty;
        public List<ItemInputDto> Inputs { get; set; } = new();
        public string? ConnectionId { get; set; }
    }

    public class ItemInputDto
    {
        public string ItemId { get; set; } = string.Empty;
        public string? RawInput { get; set; }

        // Thêm trường hứng Hàng Nguyên từ React gửi lên
        public string? UnopenedInput { get; set; }
        public string? Note { get; set; }
        public decimal? ActualBaseWeight { get; set; }
    }
}
