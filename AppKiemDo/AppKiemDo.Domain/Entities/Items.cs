using AppKiemDo.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

public class Item
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SheetId { get; set; } // Khóa ngoại, map với SheetTemplate.Id

    public string ItemName { get; set; } // Ví dụ: "Bọc xanh 5kg"
    public string Unit { get; set; } // Ví dụ: "Gr", "Lốc", "Cái"

    // Cấu hình cách tính
    public CalculationType CalculationType { get; set; }

    // Biến số cho cách tính WeightBased (Trọng lượng 1 đơn vị)
    public decimal? BaseWeight { get; set; }

    // Chuỗi công thức cho cách tính CustomFormula
    public string? CustomFormula { get; set; }

    public int DisplayOrder { get; set; } // Thứ tự sắp xếp từ trên xuống dưới trong bảng
    public string? ImageUrl { get; set; }
    public decimal? MinStockLevel { get; set; } // Tồn kho tối thiểu
    public List<string> Locations { get; set; } = new List<string>();
}
