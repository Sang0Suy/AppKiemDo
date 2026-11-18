using AppKiemDo.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Application.Interfaces
{
    public interface ICalculationService
    {
        // Hàm nhận vào chuỗi người dùng gõ (rawInput) và các cấu hình của Item đó
        decimal? Calculate(string rawInput, CalculationType type, decimal? baseWeight = null, string customFormula = null);
    }
}
