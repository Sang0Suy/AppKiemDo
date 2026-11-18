import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ROOT_URL, API_BASE_URL } from '../config'

function Admin() {
    const [sheets, setSheets] = useState([])
    const [activeSheetId, setActiveSheetId] = useState('')
    const [items, setItems] = useState([])

    // 🌟 STATE CHO TÌM KIẾM VÀ PHÂN TRANG
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Các state dùng để tạo tài khoản nhân viên
    const [empUsername, setEmpUsername] = useState('')
    const [empPassword, setEmpPassword] = useState('')
    const [empFullName, setEmpFullName] = useState('')

    // States cho Form
    const [editingId, setEditingId] = useState(null)
    const [itemName, setItemName] = useState('')
    const [unit, setUnit] = useState('')
    const [calcType, setCalcType] = useState(0)
    const [baseWeight, setBaseWeight] = useState('')
    const [customFormula, setCustomFormula] = useState('')
    const [minStockLevel, setMinStockLevel] = useState('')

    // States cho Ảnh, Khu vực và Thứ tự hiển thị
    const [imageUrl, setImageUrl] = useState('')
    const [locations, setLocations] = useState('')
    const [displayOrder, setDisplayOrder] = useState('') // 🌟 STATE MỚI CHO THỨ TỰ

    const navigate = useNavigate()

    // 🌟 LOGIC TÌM KIẾM VÀ PHÂN TRANG ĐÃ ĐƯỢC BẢO VỆ
    const safeItems = items || [];
    const filteredItems = safeItems.filter(item => {
        const safeName = item.itemName || '';
        const safeSearch = searchTerm || '';
        return safeName.toLowerCase().includes(safeSearch.toLowerCase()) ||
            (item.locations && item.locations.join(', ').toLowerCase().includes(safeSearch.toLowerCase()));
    });

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // XỬ LÝ TOKEN
    const rawToken = localStorage.getItem('token') || '';
    const cleanToken = rawToken.replace(/['"]+/g, '');
    const authConfig = {
        headers: { Authorization: `Bearer ${cleanToken}` }
    };

    const fetchItems = (sheetId) => {
        if (!sheetId) return;
        axios.get(`${API_BASE_URL}/Sheets/${sheetId}/items`)
            .then(res => {
                let data = res.data || [];
                // 🌟 KHÓA CHẾT THỨ TỰ NGAY KHI TẢI VỀ
                data.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id.localeCompare(b.id));
                setItems(data);
            })
            .catch(err => console.error("Lỗi khi tải mặt hàng:", err));
    }

    useEffect(() => {
        axios.get(`${API_BASE_URL}/Sheets`)
            .then(res => {
                const data = res.data || [];
                setSheets(data);
                if (data.length > 0) {
                    setActiveSheetId(data[0].id);
                    fetchItems(data[0].id);
                }
            })
            .catch(err => console.error("Lỗi tải Sheets:", err));
    }, []);

    const handleSheetChange = (e) => {
        const id = e.target.value
        setActiveSheetId(id)
        fetchItems(id)
        resetForm()
        setSearchTerm('')
        setCurrentPage(1)
    }

    const resetForm = () => {
        setEditingId(null)
        setItemName('')
        setUnit('')
        setCalcType(0)
        setBaseWeight('')
        setCustomFormula('')
        setMinStockLevel('')
        setImageUrl('')
        setLocations('')
        setDisplayOrder('') // 🌟 ĐẶT LẠI TRỐNG SAU KHI LƯU
    }

    const handleEditClick = (item) => {
        setEditingId(item.id)
        setItemName(item.itemName)
        setUnit(item.unit)
        setCalcType(item.calculationType)
        setBaseWeight(item.baseWeight || '')
        setCustomFormula(item.customFormula || '')
        setMinStockLevel(item.minStockLevel || '')
        setImageUrl(item.imageUrl || '')
        setLocations(item.locations ? item.locations.join(', ') : '')
        setDisplayOrder(item.displayOrder || '') // 🌟 TẢI THỨ TỰ LÊN Ô NHẬP LIỆU
    }

    const handleCreateEmployee = async (e) => {
        e.preventDefault()
        if (!empUsername || !empPassword || !empFullName) return toast.warn("Vui lòng nhập đủ thông tin!")

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/Auth/create-user`, {
                Username: empUsername,
                Password: empPassword,
                FullName: empFullName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            toast.success("Tạo tài khoản nhân viên thành công!")
            setEmpUsername('')
            setEmpPassword('')
            setEmpFullName('')
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi khi tạo tài khoản!")
        }
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            toast.info("Đang tải ảnh lên...");
            const res = await axios.post(`${API_BASE_URL}/Upload/image`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${cleanToken}`
                }
            });
            setImageUrl(res.data.url);
            toast.success("Tải ảnh thành công!");
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi tải ảnh lên máy chủ!");
        }
    }

    const handleSubmitItem = () => {
        if (!itemName || !unit) return toast.error("Vui lòng nhập Tên hàng và ĐVT!")

        const locationsArray = locations.split(',')
            .map(loc => loc.trim())
            .filter(loc => loc !== '');

        const payload = {
            sheetId: activeSheetId,
            itemName: itemName,
            unit: unit,
            calculationType: calcType,
            baseWeight: calcType === 1 ? parseFloat(baseWeight) : null,
            customFormula: calcType === 2 ? customFormula : null,
            minStockLevel: minStockLevel ? parseFloat(minStockLevel) : null,

            // 🌟 LẤY SỐ THỨ TỰ BẠN NHẬP, HOẶC TỰ TĂNG NẾU TẠO MỚI
            displayOrder: displayOrder !== '' ? parseInt(displayOrder) : (editingId ? undefined : items.length + 1),

            imageUrl: imageUrl,
            locations: locationsArray
        }

        if (editingId) {
            axios.put(`${API_BASE_URL}/Items/${editingId}`, payload, authConfig)
                .then(() => { toast.success("Cập nhật thành công!"); fetchItems(activeSheetId); resetForm(); })
                .catch(() => toast.error("Có lỗi xảy ra khi cập nhật!"))
        } else {
            axios.post(`${API_BASE_URL}/Items`, payload, authConfig)
                .then(() => { toast.success("Thêm mới thành công!"); fetchItems(activeSheetId); resetForm(); })
                .catch(() => toast.error("Có lỗi xảy ra khi thêm!"))
        }
    }

    const handleDeleteItem = (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa mặt hàng này?")) {
            axios.delete(`${API_BASE_URL}/Items/${id}`, authConfig)
                .then(() => { toast.success("Đã xóa mặt hàng!"); fetchItems(activeSheetId); })
                .catch(() => toast.error("Xóa thất bại!"))
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('token')
        navigate('/login')
    }

    return (
        <div className="container" style={{ padding: '20px', textAlign: 'left', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0 }}>QUẢN TRỊ DANH MỤC</h1>
                <div>
                    <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginRight: '10px' }}>📊 Xem Thống Kê</button>
                    <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Thoát / Đăng xuất</button>
                </div>
            </div>

            <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#28a745' }}>👤 Cấp Tài Khoản Nhân Viên</h3>
                <form onSubmit={handleCreateEmployee} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Tên đăng nhập..." value={empUsername} onChange={e => setEmpUsername(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    <input type="password" placeholder="Mật khẩu..." value={empPassword} onChange={e => setEmpPassword(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    <input type="text" placeholder="Tên thật (VD: Nguyễn Văn A)" value={empFullName} onChange={e => setEmpFullName(e.target.value)} style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ TẠO TÀI KHOẢN</button>
                </form>
            </div>

            <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0 }}>{editingId ? 'Cập Nhật Mặt Hàng' : 'Thêm Mặt Hàng Mới'}</h3>
                    {editingId && <button onClick={resetForm} style={{ padding: '5px 10px', cursor: 'pointer' }}>Hủy sửa</button>}
                </div>

                <select value={activeSheetId} onChange={handleSheetChange} style={{ padding: '8px', marginBottom: '15px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {sheets?.map(s => <option key={s.id} value={s.id}>{s.sheetName}</option>)}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <input type="text" placeholder="Tên hàng" value={itemName} onChange={e => setItemName(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    <input type="text" placeholder="Đơn vị tính" value={unit} onChange={e => setUnit(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />

                    <select value={calcType} onChange={e => setCalcType(Number(e.target.value))} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                        <option value={0}>Nhập thủ công</option>
                        <option value={1}>Chia trọng lượng</option>
                        <option value={2}>Công thức động (NCalc)</option>
                    </select>

                    <input type="number" placeholder="Mức tồn kho báo động (VD: 5)" value={minStockLevel} onChange={e => setMinStockLevel(e.target.value)} min="0" step="0.1" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />

                    {calcType === 1 && <input type="number" placeholder="Trọng lượng 1 đơn vị" value={baseWeight} onChange={e => setBaseWeight(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />}
                    {calcType === 2 && <input type="text" placeholder="Công thức (VD: [Input] - 2)" value={customFormula} onChange={e => setCustomFormula(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />}

                    <input type="text" placeholder="Khu vực (VD: Kho khô, Bếp chính)" value={locations} onChange={e => setLocations(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />

                    {/* 🌟 Ô NHẬP SỐ THỨ TỰ MỚI */}
                    <input type="number" placeholder="Thứ tự hiển thị (VD: 1, 2, 3...)" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '14px' }} />
                        {imageUrl && <img src={`${ROOT_URL}${imageUrl}`} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }} />}
                    </div>
                </div>

                <button onClick={handleSubmitItem} style={{ padding: '10px 20px', backgroundColor: editingId ? '#FF9800' : '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {editingId ? '💾 Lưu Cập Nhật' : '+ Thêm mặt hàng'}
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <input
                    type="text"
                    placeholder="🔍 Tìm theo tên hoặc khu vực..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    style={{ padding: '10px', width: '100%', maxWidth: '300px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table border="1" cellPadding="12" style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f4f4f4', textAlign: 'left' }}>
                            <th>Hình Ảnh</th>
                            <th>Tên Hàng & Khu Vực</th>
                            <th>ĐVT</th>
                            <th style={{ textAlign: 'center' }}>Hành Động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems?.map(item => (
                            <tr key={item.id}>
                                <td style={{ textAlign: 'center' }}>
                                    {item.imageUrl ? <img src={`${ROOT_URL}${item.imageUrl}`} alt="img" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} /> : '❌'}
                                </td>
                                <td>
                                    {/* 🌟 HIỂN THỊ NHÃN THỨ TỰ */}
                                    {item.displayOrder && (
                                        <span style={{ display: 'inline-block', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', color: '#0050b3', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', marginRight: '8px', fontWeight: 'bold' }}>
                                            #{item.displayOrder}
                                        </span>
                                    )}
                                    <strong>{item.itemName}</strong>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                        📍 {item.locations?.length > 0 ? item.locations.join(', ') : 'Chưa phân khu'}
                                    </div>
                                </td>
                                <td>{item.unit}</td>
                                <td style={{ textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <button onClick={() => handleEditClick(item)} style={{ backgroundColor: '#FFC107', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sửa</button>
                                    <button onClick={() => handleDeleteItem(item.id)} style={{ backgroundColor: '#f44336', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Xóa</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        style={{ padding: '8px 15px', borderRadius: '4px', border: '1px solid #ccc', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', backgroundColor: currentPage === 1 ? '#f5f5f5' : 'white', fontWeight: 'bold' }}
                    >
                        ⬅ Trước
                    </button>

                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>Trang {currentPage} / {totalPages}</span>

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        style={{ padding: '8px 15px', borderRadius: '4px', border: '1px solid #ccc', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', backgroundColor: currentPage === totalPages ? '#f5f5f5' : 'white', fontWeight: 'bold' }}
                    >
                        Sau ➡
                    </button>
                </div>
            )}
        </div>
    )
}

export default Admin