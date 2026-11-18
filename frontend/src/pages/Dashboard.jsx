import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

function Dashboard() {
    const [sheets, setSheets] = useState([]);
    const [activeSheetId, setActiveSheetId] = useState('');
    const [stats, setStats] = useState({ TotalChecks: 0, TopItems: [] });
    const navigate = useNavigate();

    useEffect(() => {
        axios.get(`${API_BASE_URL}/Sheets`)
            .then(res => {
                const data = res.data || []; // 🌟 BẢO VỆ TRÁNH LỖI UNDEFINED LENGTH
                setSheets(data);
                if (data.length > 0) {
                    setActiveSheetId(data[0].id);
                }
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (!activeSheetId) return;
        axios.get(`${API_BASE_URL}/Inventory/dashboard-stats/${activeSheetId}`)
            .then(res => {
                // 🌟 BẢO VỆ TRÁNH TRƯỜNG HỢP API THỐNG KÊ TRẢ VỀ RỖNG
                const statData = res.data || { TotalChecks: 0, TopItems: [] };
                setStats(statData);
            })
            .catch(err => console.error(err));
    }, [activeSheetId]);

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #2196F3', paddingBottom: '10px', marginBottom: '20px' }}>
                <h1 style={{ margin: 0 }}>📈 TỔNG QUAN HỆ THỐNG</h1>
                <button onClick={() => navigate('/admin')} style={{ padding: '8px 15px', backgroundColor: '#607d8b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    ⬅ Quay lại Quản trị
                </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Chọn Tờ Kiểm:</label>
                <select value={activeSheetId} onChange={e => setActiveSheetId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {sheets?.map(s => <option key={s.id} value={s.id}>{s.sheetName}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px' }}>
                {/* THẺ CHỈ SỐ NHANH */}
                <div style={{ backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>Tổng lượt kiểm (7 ngày)</h3>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#0d47a1' }}>
                        {stats.TotalChecks}
                    </div>
                </div>

                {/* KHU VỰC BIỂU ĐỒ */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Top 5 Hàng Hóa Có Số Lượng Lớn Nhất</h3>
                    <div style={{ height: '300px' }}>
                        {stats.TopItems && stats.TopItems.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.TopItems} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="itemName" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="totalCalculated" name="Tổng Thực Tế" fill="#ff7300" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ textAlign: 'center', paddingTop: '100px', color: '#999' }}>Chưa có đủ dữ liệu để vẽ biểu đồ.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;