using AppKiemDo.Domain.Entities;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Infrastructure.Data
{
    public class MongoDbContext
    {
        private readonly IMongoDatabase _database;

        public MongoDbContext(string connectionString, string databaseName)
        {
            var client = new MongoClient(connectionString);
            _database = client.GetDatabase(databaseName);
        }

        // Định nghĩa các Collection sẽ sử dụng
        // Code chuẩn để nối đúng vào Collection trên Atlas:
        public IMongoCollection<SheetTemplate> SheetTemplates => _database.GetCollection<SheetTemplate>("Sheets");

        public IMongoCollection<Item> Items =>
            _database.GetCollection<Item>("Items");

        public IMongoCollection<DailyRecord> DailyRecords =>
            _database.GetCollection<DailyRecord>("DailyRecords");
        public IMongoCollection<User> Users => _database.GetCollection<User>("Users");
        public IMongoCollection<AuditLog> AuditLogs => _database.GetCollection<AuditLog>("AuditLogs");
    }
}
