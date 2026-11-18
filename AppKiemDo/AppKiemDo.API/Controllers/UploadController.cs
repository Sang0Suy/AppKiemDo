using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AppKiemDo.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UploadController : ControllerBase
    {
        // Công cụ giúp C# tìm được đường dẫn tuyệt đối đến thư mục wwwroot trên máy chủ
        private readonly IWebHostEnvironment _env;

        public UploadController(IWebHostEnvironment env)
        {
            _env = env;
        }

        [HttpPost("image")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Không có file nào được chọn.");

            // 1. Kiểm tra đuôi file (Chỉ cho phép ảnh để bảo mật server)
            var ext = Path.GetExtension(file.FileName).ToLower();
            var allowedExts = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            if (!allowedExts.Contains(ext))
                return BadRequest("Chỉ hỗ trợ upload file ảnh (.jpg, .png, .jpeg, .gif, .webp).");

            // 2. Xác định thư mục lưu (Sẽ tự tạo thư mục "uploads" bên trong wwwroot nếu chưa có)
            string uploadsFolder = Path.Combine(_env.WebRootPath, "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            // 3. Đổi tên file để không bao giờ bị trùng lặp (Dùng Guid)
            string uniqueFileName = Guid.NewGuid().ToString() + ext;
            string filePath = Path.Combine(uploadsFolder, uniqueFileName);

            // 4. Lưu file vào ổ cứng máy chủ SmarterASP
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // 5. Trả về đường dẫn để React gọi hiển thị (Ví dụ: /uploads/abc-xyz.jpg)
            // Vì đã có app.UseStaticFiles() nên link này tự động truy cập được qua web.
            string fileUrl = $"/uploads/{uniqueFileName}";

            return Ok(new { Url = fileUrl });
        }
    }
}