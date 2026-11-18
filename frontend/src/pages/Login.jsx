import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

// Tự động chọn localhost:5270 khi chạy trên máy, và dùng đường dẫn gốc khi đưa lên SmarterASP
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5270/api'
    : '/api';

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const response = await axios.post(`${API_BASE_URL}/Auth/login`, {
                Username: username.trim(),
                Password: password
            })

            // Lưu thông tin đăng nhập
            localStorage.setItem('token', response.data.token)
            localStorage.setItem('role', response.data.role)
            localStorage.setItem('fullName', response.data.fullName)

            toast.success(`Chào mừng ${response.data.fullName}!`)

            if (response.data.role === 'Manager') {
                navigate('/admin')
            } else {
                navigate('/')
            }

        } catch (error) {
            console.error("Chi tiết lỗi đăng nhập:", error);

            // Phân loại lỗi rõ ràng thay vì báo chung chung
            if (error.response) {
                if (error.response.status === 401 || error.response.status === 400) {
                    toast.error('Sai tài khoản hoặc mật khẩu!')
                } else {
                    toast.error(`Lỗi máy chủ (${error.response.status}): ${error.response.data?.Message || 'Vui lòng kiểm tra lại Server!'}`)
                }
            } else {
                toast.error('Không thể kết nối tới máy chủ API (Lỗi mạng hoặc CORS)!')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>QUẢN TRỊ HỆ THỐNG</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input
                    type="text"
                    placeholder="Tên đăng nhập"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={{ padding: '12px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                    required
                    disabled={isLoading}
                />
                <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ padding: '12px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                    required
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                        padding: '12px',
                        backgroundColor: isLoading ? '#9e9e9e' : '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        transition: 'background-color 0.3s'
                    }}
                >
                    {isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
                </button>
            </form>
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                    📱 Trải nghiệm tốt hơn trên thiết bị di động
                </p>
                <a
                    href="/downloads/AppKiemDo.zip"
                    download
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                        backgroundColor: '#4CAF50', color: 'white', textDecoration: 'none',
                        borderRadius: '25px', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                >
                    ⬇️ Tải App Android (.APK)
                </a>
            </div>
        </div>
    )
}

export default Login