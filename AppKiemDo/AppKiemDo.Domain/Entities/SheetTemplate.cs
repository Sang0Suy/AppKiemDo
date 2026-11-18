using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Domain.Entities
{
    public class SheetTemplate
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string SheetName { get; set; } // Ví dụ: "KIỂM TRA HÀNG HÓA-LẠNH 1"
        public string Description { get; set; }
        public int DisplayOrder { get; set; } // Thứ tự sắp xếp các tab/sheet
        public bool IsActive { get; set; } = true;
    }
}
