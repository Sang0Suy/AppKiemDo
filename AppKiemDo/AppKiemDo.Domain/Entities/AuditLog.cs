using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AppKiemDo.Domain.Entities
{
    public class AuditLog
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }

        public string SheetId { get; set; } = string.Empty;
        public string ItemId { get; set; } = string.Empty;
        public string ItemName { get; set; } = string.Empty; // Lưu tên mặt hàng để hiển thị ngay không cần join bảng
        public string Action { get; set; } = string.Empty; // VD: "UPDATE_RECORD"
        public string ChangedValue { get; set; } = string.Empty;
        public string PerformedBy { get; set; } = string.Empty; // Tên nhân viên thao tác
        public DateTime Timestamp { get; set; }
    }
}