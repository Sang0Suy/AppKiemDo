using AppKiemDo.Domain.Entities;
using AppKiemDo.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly MongoDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(MongoDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // 1. API Đăng nhập cho cả Quản lý và Nhân viên
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users.Find(u => u.Username == request.Username).FirstOrDefaultAsync();

            if (user == null || user.PasswordHash != HashPassword(request.Password))
                return Unauthorized(new { Message = "Sai tài khoản hoặc mật khẩu!" });

            // Cấp Token chứa Quyền và Tên Đầy Đủ
            var token = GenerateJwtToken(user);
            return Ok(new { Token = token, Role = user.Role, FullName = user.FullName });
        }

        // 2. API Cấp tài khoản nhân viên (CHỈ ADMIN MỚI ĐƯỢC GỌI)
        [Authorize(Roles = "Manager")]
        [HttpPost("create-user")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var exists = await _context.Users.Find(u => u.Username == request.Username).AnyAsync();
            if (exists) return BadRequest(new { Message = "Tên đăng nhập đã tồn tại!" });

            var newUser = new User
            {
                Username = request.Username,
                PasswordHash = HashPassword(request.Password),
                FullName = request.FullName,
                Role = "Employee" // Mặc định tạo ra là nhân viên
            };

            await _context.Users.InsertOneAsync(newUser);
            return Ok(new { Message = "Tạo tài khoản nhân viên thành công!" });
        }

        // 3. API Khởi tạo Admin đầu tiên (Giấu kín, chỉ gọi 1 lần bằng Postman/Swagger lúc setup)
        [HttpPost("seed-admin")]
        public async Task<IActionResult> SeedAdmin()
        {
            var adminExists = await _context.Users.Find(u => u.Role == "Manager").AnyAsync();
            if (adminExists) return BadRequest("Đã có tài khoản Admin trong hệ thống!");

            var admin = new User
            {
                Username = "admin",
                PasswordHash = HashPassword("123456"), // Pass mặc định, nên đổi sau
                FullName = "Quản Lý Cấp Cao",
                Role = "Manager"
            };
            await _context.Users.InsertOneAsync(admin);
            return Ok(new { Message = "Đã khởi tạo tài khoản Admin mặc định (admin / 123456)" });
        }

        // --- CÁC HÀM HỖ TRỢ ---
        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("FullName", user.FullName), // Nhét tên vào Token
                new Claim(ClaimTypes.Role, user.Role) // Nhét quyền vào Token
            };

            var token = new JwtSecurityToken(_config["Jwt:Issuer"],
              _config["Jwt:Audience"],
              claims,
              expires: DateTime.Now.AddDays(7), // Token sống 7 ngày
              signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
            return Convert.ToBase64String(bytes);
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public class CreateUserRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
        public string FullName { get; set; }
    }
}