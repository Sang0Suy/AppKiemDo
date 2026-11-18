using AppKiemDo.Application.Interfaces;
using AppKiemDo.Domain.Enums;
using NCalc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AppKiemDo.Application.Services
{
    public class DynamicCalculationService : ICalculationService
    {
        public decimal? Calculate(string rawInput, CalculationType type, decimal? baseWeight = null, string customFormula = null)
        {
            if (string.IsNullOrWhiteSpace(rawInput)) return null;

            switch (type)
            {
                case CalculationType.Manual:
                    // Nếu là nhập thủ công (như "Hết", "3N / 1L"), không tính toán số liệu
                    // Nếu tình cờ họ gõ số (như "15"), thì parse ra số
                    if (decimal.TryParse(rawInput, out decimal manualResult)) return manualResult;
                    return null;

                case CalculationType.WeightBased:
                    // Cách tính chia trọng lượng: Tổng khối lượng / Trọng lượng 1 đơn vị
                    if (!baseWeight.HasValue || baseWeight.Value <= 0)
                        throw new ArgumentException("BaseWeight phải được cấu hình và lớn hơn 0");

                    if (decimal.TryParse(rawInput, out decimal totalWeight))
                    {
                        // Áp dụng làm tròn xuống để tránh hụt hàng tồn kho
                        return Math.Floor(totalWeight / baseWeight.Value);
                    }
                    return null;

                case CalculationType.CustomFormula:
                    // Cách tính dùng NCalc cho công thức tự định nghĩa
                    if (string.IsNullOrWhiteSpace(customFormula)) return null;

                    try
                    {
                        Expression e = new Expression(customFormula);

                        // Quy ước: Chuỗi người dùng nhập vào sẽ được gán cho biến [Input] trong công thức
                        if (decimal.TryParse(rawInput, out decimal inputValue))
                        {
                            e.Parameters["Input"] = inputValue;
                        }

                        var result = e.Evaluate();
                        return Math.Round(Convert.ToDecimal(result), 0);
                    }
                    catch
                    {
                        // Bắt lỗi nếu công thức khai báo sai cú pháp
                        return null;
                    }

                default:
                    return null;
            }
        }
    }
}
