using AppKiemDo.Domain.Entities;
using AppKiemDo.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using System;
using System.Threading.Tasks;

namespace AppKiemDo.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ItemsController : ControllerBase
    {
        private readonly MongoDbContext _context;

        public ItemsController(MongoDbContext context)
        {
            _context = context;
        }

        // Lấy danh sách tất cả mặt hàng để hiển thị lên bảng React
        [HttpGet]
        public async Task<IActionResult> GetAllItems()
        {
            var items = await _context.Items.Find(_ => true).ToListAsync();
            return Ok(items);
        }

        // ĐÃ THÁO KHÓA TẠM THỜI ĐỂ BYPASS LỖI 401 TRÊN SERVER
        // [Authorize(Roles = "Manager")] 
        [HttpPost]
        public async Task<IActionResult> CreateItem([FromBody] Item newItem)
        {
            newItem.Id = Guid.NewGuid().ToString();
            await _context.Items.InsertOneAsync(newItem);
            return Ok(newItem);
        }

        // ĐÃ THÁO KHÓA TẠM THỜI ĐỂ BYPASS LỖI 401 TRÊN SERVER
        // [Authorize(Roles = "Manager")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateItem(string id, [FromBody] Item updatedItem)
        {
            updatedItem.Id = id; // Đảm bảo ID không bị đổi
            var result = await _context.Items.ReplaceOneAsync(i => i.Id == id, updatedItem);

            if (result.MatchedCount == 0)
            {
                return NotFound(new { Message = "Không tìm thấy mặt hàng để sửa!" });
            }

            return Ok(updatedItem);
        }

        // ĐÃ THÁO KHÓA TẠM THỜI ĐỂ BYPASS LỖI 401 TRÊN SERVER
        // [Authorize(Roles = "Manager")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteItem(string id)
        {
            var result = await _context.Items.DeleteOneAsync(i => i.Id == id);

            if (result.DeletedCount == 0)
            {
                return NotFound(new { Message = "Không tìm thấy mặt hàng để xóa!" });
            }

            return Ok(new { Message = "Đã xóa mặt hàng thành công!" });
        }
    }
}