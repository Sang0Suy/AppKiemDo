using Microsoft.AspNetCore.SignalR;

namespace AppKiemDo.API.Hubs
{
    // Hub này đóng vai trò như một trạm thu phát tín hiệu giữa C# và React
    public class InventoryHub : Hub
    {
        public async Task SendLiveEdit(string sheetId, string date, string itemId, string field, string value)
        {
            // Clients.Others: Gửi cho tất cả mọi người TRỪ cái máy vừa gửi lên
            await Clients.Others.SendAsync("ReceiveLiveEdit", sheetId, date, itemId, field, value);
        }
    }
}