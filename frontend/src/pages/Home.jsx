import { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { AgGridReact } from 'ag-grid-react'
import { toast } from 'react-toastify'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import * as signalR from '@microsoft/signalr'
import { useNavigate } from 'react-router-dom';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import '../App.css'
import { ROOT_URL, API_BASE_URL } from '../config'

ModuleRegistry.registerModules([AllCommunityModule])

const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function Home() {
    const [sheets, setSheets] = useState([])
    const [activeSheetId, setActiveSheetId] = useState(null)
    const [loading, setLoading] = useState(true)

    const [rowData, setRowData] = useState([])
    const [pastDatesState, setPastDatesState] = useState([])
    const [isEditing, setIsEditing] = useState(true)
    const [checkerName, setCheckerName] = useState(localStorage.getItem('fullName') || '')
    const [checkDate, setCheckDate] = useState(getLocalDateStr())

    const [allLocations, setAllLocations] = useState([])
    const [selectedLocation, setSelectedLocation] = useState('All')

    const [selectedItemInfo, setSelectedItemInfo] = useState(null)
    const [showModal, setShowModal] = useState(false)

    const [refreshKey, setRefreshKey] = useState(0)
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [hubConnection, setHubConnection] = useState(null)

    // 🌟 STATE CHO MÁY TÍNH ẢO NỔI TOÀN CỤC (CHỐNG MỌI LỖI FOCUS)
    const [calcModal, setCalcModal] = useState({
        isOpen: false,
        rowId: null,
        field: null,
        value: '',
        itemName: '',
        colName: ''
    });
    const [reviewMode, setReviewMode] = useState(false);
    const [allGridData, setAllGridData] = useState([]);
    const [uncheckedAlert, setUncheckedAlert] = useState({ show: false, items: [], type: '' });

    const gridRef = useRef(null)
    const activeSheetIdRef = useRef(activeSheetId);
    const checkDateRef = useRef(checkDate);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    }

    useEffect(() => {
        activeSheetIdRef.current = activeSheetId;
        checkDateRef.current = checkDate;
    }, [activeSheetId, checkDate]);

    // Lắng nghe SignalR
    useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${ROOT_URL}/inventoryHub`)
            .withAutomaticReconnect()
            .build();

        connection.start()
            .then(() => setHubConnection(connection))
            .catch(err => console.error("Lỗi kết nối SignalR: ", err));

        connection.on("ReceiveInventoryUpdate", (updatedSheetId, updatedDate, senderId) => {
            if (connection.connectionId === senderId) return;
            if (activeSheetIdRef.current === updatedSheetId && checkDateRef.current === updatedDate) {
                toast.info("🔄 Dữ liệu vừa được chốt lưu bởi máy khác!");
                setRefreshKey(prev => prev + 1);
            }
        });

        connection.on("ReceiveLiveEdit", (uSheet, uDate, uItemId, uField, uValue) => {
            if (activeSheetIdRef.current === uSheet && checkDateRef.current === uDate) {
                setRowData(prev => prev.map(row => {
                    if (row.id === uItemId) {
                        const newRow = { ...row };
                        newRow[uField] = uValue;

                        const rawStr = String(newRow.rawInput || '').trim();
                        if (!rawStr) {
                            newRow.calculatedValue = '-';
                        } else {
                            const parseToNum = (valStr) => {
                                if (!valStr) return 0;
                                if (/^[\d+\-*/.()\s]+$/.test(valStr)) { try { return Number(new Function('return ' + valStr)()); } catch { return 0; } }
                                const n = parseFloat(valStr);
                                return isNaN(n) ? 0 : n;
                            };
                            const rawNum = parseToNum(rawStr);
                            let openedTotal;

                            if (newRow.calculationType === 1 && newRow.actualBaseWeight) {
                                openedTotal = rawNum / parseFloat(newRow.actualBaseWeight);
                            } else if (newRow.calculationType === 2 && newRow.customFormula) {
                                try { openedTotal = Number(new Function('return ' + newRow.customFormula.replace(/\[Input\]/g, rawNum))()); } catch { openedTotal = 0; }
                            } else { openedTotal = rawNum; }

                            const isRawText = rawStr && isNaN(parseFloat(rawStr)) && !/^[\d+\-*/.()\s]+$/.test(rawStr);
                            if (isRawText) { newRow.calculatedValue = rawStr; } else { newRow.calculatedValue = isNaN(openedTotal) ? '-' : Math.round(openedTotal * 100) / 100; }
                        }
                        return newRow;
                    }
                    return row;
                }));
            }
        });

        return () => connection.stop();
    }, []);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/Sheets`)
            .then(response => { setSheets(response.data); setLoading(false); })
            .catch(error => { console.error("Lỗi:", error); setLoading(false); })
    }, [])

    useEffect(() => {
        if (!activeSheetId) return;

        const loadWorkspace = async () => {
            try {
                const isAdmin = !!localStorage.getItem('token');
                const isToday = checkDate === getLocalDateStr();
                setIsEditing(isToday || isAdmin);

                const itemsRes = await axios.get(`${API_BASE_URL}/Sheets/${activeSheetId}/items`);
                let fetchedItems = itemsRes.data || [];
                fetchedItems.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id.localeCompare(b.id));

                const uniqueLocations = new Set();
                fetchedItems.forEach(item => {
                    if (item.locations && Array.isArray(item.locations)) {
                        item.locations.forEach(loc => uniqueLocations.add(loc));
                    }
                });
                setAllLocations(Array.from(uniqueLocations).sort());

                const currentDataRes = await axios.get(`${API_BASE_URL}/Inventory/daily?sheetId=${activeSheetId}&date=${checkDate}`).catch(() => null);
                const currentData = currentDataRes?.data?.details || [];
                const currentDict = {};
                currentData.forEach(d => currentDict[d.itemId] = d);

                if (currentDataRes?.data?.checkerName) setCheckerName(currentDataRes.data.checkerName);

                const pastDates = [];
                for (let i = 7; i >= 1; i--) {
                    const d = new Date(checkDate);
                    d.setDate(d.getDate() - i);
                    pastDates.push(getLocalDateStr(d));
                }
                const historyPromises = pastDates.map(date => axios.get(`${API_BASE_URL}/Inventory/daily?sheetId=${activeSheetId}&date=${date}`).catch(() => null));
                const historyResults = await Promise.all(historyPromises);

                const historyDict = {};
                pastDates.forEach((date, index) => {
                    historyDict[date] = {};
                    const res = historyResults[index];
                    if (res && res.data) {
                        res.data.details.forEach(d => { historyDict[date][d.itemId] = { opened: d.rawInput || '-', unopened: d.unopenedInput || '-' }; });
                    }
                });

                const gridData = fetchedItems.map(item => {
                    const current = currentDict[item.id] || {};
                    const row = {
                        ...item,
                        rawInput: current.rawInput || '',
                        unopenedInput: current.unopenedInput || '',
                        actualBaseWeight: item.calculationType === 1
                            ? (current.actualBaseWeight ?? item.baseWeight)
                            : '',
                        calculatedValue: current.calculatedValue || '-'
                    };
                    pastDates.forEach((date, i) => {
                        const hist = historyDict[date][item.id] || { opened: '-', unopened: '-' };
                        row[`day_${i}_opened`] = hist.opened;
                        row[`day_${i}_unopened`] = hist.unopened;
                    });
                    return row;
                });

                setPastDatesState(pastDates);
                setRowData(gridData);
            } catch (error) { console.error("Lỗi khi tải dữ liệu:", error); }
        };

        loadWorkspace();
    }, [activeSheetId, checkDate, refreshKey])

    // Offline Sync
    useEffect(() => {
        const syncOfflineData = async () => {
            const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
            if (queue.length === 0) return;

            toast.info("🔄 Mạng đã kết nối lại! Đang đồng bộ dữ liệu kho...");
            let successCount = 0;

            for (const payload of queue) {
                try {
                    await axios.post(`${API_BASE_URL}/Inventory/daily`, payload);
                    successCount++;
                } catch (error) {
                    console.error("Lỗi đồng bộ ngoại tuyến:", error);
                }
            }

            if (successCount === queue.length) {
                localStorage.removeItem('offlineQueue');
                toast.success("✅ Đã đồng bộ 100% dữ liệu ngoại tuyến!");
                setRefreshKey(prev => prev + 1);
            }
        };

        window.addEventListener('online', syncOfflineData);
        if (navigator.onLine) syncOfflineData();

        return () => window.removeEventListener('online', syncOfflineData);
    }, []);

    const saveToOfflineQueue = (payload) => {
        const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
        const newQueue = queue.filter(q => !(q.sheetId === payload.sheetId && q.checkDate === payload.checkDate));
        newQueue.push(payload);
        localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
        toast.info("📶 Đã mất kết nối! Dữ liệu được lưu tạm trên máy.");
    };

    const filteredRowData = useMemo(() => {
        if (selectedLocation === 'All') return rowData;
        return rowData.filter(row => row.locations && row.locations.includes(selectedLocation));
    }, [rowData, selectedLocation])

    // 🌟 XỬ LÝ KHI CHỐT SỐ TỪ MÁY TÍNH NỔI
    const handleSaveCalcValue = () => {
        const { rowId, field, value } = calcModal;
        setCalcModal(prev => ({ ...prev, isOpen: false }));

        setRowData(prev => prev.map(row => {
            if (row.id === rowId) {
                const newData = { ...row, [field]: value };
                const rawStr = String(newData.rawInput || '').trim();

                if (!rawStr) {
                    newData.calculatedValue = '-';
                } else {
                    const parseToNum = (valStr) => {
                        if (!valStr) return 0;
                        if (/^[\d+\-*/.()\s]+$/.test(valStr)) { try { return Number(new Function('return ' + valStr)()); } catch { return 0; } }
                        const n = parseFloat(valStr);
                        return isNaN(n) ? 0 : n;
                    };

                    const rawNum = parseToNum(rawStr);
                    let openedTotal;

                    if (newData.calculationType === 1 && newData.actualBaseWeight) {
                        openedTotal = rawNum / parseFloat(newData.actualBaseWeight);
                    } else if (newData.calculationType === 2 && newData.customFormula) {
                        try { const formula = newData.customFormula.replace(/\[Input\]/g, rawNum); openedTotal = Number(new Function('return ' + formula)()); } catch { openedTotal = 0; }
                    } else { openedTotal = rawNum; }

                    const isRawText = rawStr && isNaN(parseFloat(rawStr)) && !/^[\d+\-*/.()\s]+$/.test(rawStr);
                    if (isRawText) { newData.calculatedValue = rawStr; } else { newData.calculatedValue = isNaN(openedTotal) ? '-' : Math.round(openedTotal * 100) / 100; }
                }

                // Gửi SignalR đồng bộ ngay lập tức
                if (hubConnection) {
                    hubConnection.invoke("SendLiveEdit", activeSheetIdRef.current, checkDateRef.current, newData.id, field, String(value || ''))
                        .catch(err => console.error(err));
                }

                return newData;
            }
            return row;
        }));
    };

    const columnDefs = useMemo(() => {
        const cols = [
            {
                headerName: "Tên Hàng", field: "itemName", width: 95, pinned: 'left', editable: false,
                cellStyle: { backgroundColor: '#fcfcfc', fontWeight: 'bold', color: '#1890ff', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                onCellClicked: (params) => { setSelectedItemInfo(params.data); setShowModal(true); }
            },
            {
                headerName: "ĐVT", field: "unit", width: 55, pinned: 'left', editable: false,
                cellStyle: { backgroundColor: '#fcfcfc', borderRight: '2px solid #bdbdbd', textAlign: 'center' }
            }
        ];

        pastDatesState.forEach((date, i) => {
            const shortDate = date.split('-')[2] + '/' + date.split('-')[1];
            cols.push({
                headerName: shortDate,
                children: [
                    { headerName: "Lẻ", field: `day_${i}_opened`, width: 55, editable: false, cellStyle: { backgroundColor: '#f9f9f9', color: '#888' } },
                    { headerName: "Nguyên", field: `day_${i}_unopened`, width: 65, editable: false, cellStyle: { backgroundColor: '#f9f9f9', color: '#888', borderRight: '1px solid #ddd' } }
                ]
            });
        });

        // 🌟 KHI CLICK VÀO Ô SẼ BẬT MÁY TÍNH NỔI
        const openCalculator = (params) => {
            if (!isEditing) return;
            if (params.colDef.field === 'actualBaseWeight' && params.data.calculationType !== 1) return;

            setCalcModal({
                isOpen: true,
                rowId: params.data.id,
                field: params.colDef.field,
                value: String(params.data[params.colDef.field] || ''),
                itemName: params.data.itemName,
                colName: params.colDef.headerName
            });
        };

        cols.push({
            headerName: "SỐ LIỆU ĐANG CHỌN",
            children: [
                {
                    headerName: "Hàng Lẻ", field: "rawInput", editable: false, width: 90,
                    onCellClicked: openCalculator,
                    cellStyle: () => isEditing ? { backgroundColor: '#fffbe6', border: '1px solid #faad14', cursor: 'pointer' } : { backgroundColor: '#f5f5f5', color: '#999' }
                },
                {
                    headerName: "TL/1 Đơn", field: "actualBaseWeight", editable: false, width: 100,
                    onCellClicked: openCalculator,
                    cellStyle: (params) => { if (params.data.calculationType !== 1) return { backgroundColor: '#f0f0f0', color: '#ccc' }; return isEditing ? { backgroundColor: '#fffbe6', border: '1px solid #faad14', cursor: 'pointer' } : { backgroundColor: '#e6f7ff', color: '#0050b3' }; }
                },
                {
                    headerName: "Hàng Nguyên", field: "unopenedInput", editable: false, width: 105,
                    onCellClicked: openCalculator,
                    cellStyle: () => isEditing ? { backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', cursor: 'pointer' } : { backgroundColor: '#f5f5f5', color: '#999' }
                }
            ]
        });

        cols.push({
            headerName: "TỔNG THỰC TẾ", field: "calculatedValue", width: 120, editable: false,
            cellStyle: (params) => {
                const val = parseFloat(params.value);
                const minStock = parseFloat(params.data?.minStockLevel);
                if (!isNaN(val) && !isNaN(minStock) && val <= minStock) {
                    return { fontWeight: 'bold', color: 'white', textAlign: 'center', backgroundColor: '#ff4d4f' };
                }
                return { fontWeight: 'bold', color: '#d32f2f', textAlign: 'center', backgroundColor: '#fff0f6' };
            }
        });

        return cols;
    }, [isEditing, pastDatesState]);

    const handleSheetClick = (sheetId) => {
        setActiveSheetId(sheetId)
        setCheckDate(getLocalDateStr())
        setSelectedLocation('All')
    }

    const handleSaveLocation = () => {
        const latestData = rowData;
        let itemsInLoc = latestData;
        if (selectedLocation && selectedLocation !== 'All') {
            itemsInLoc = latestData.filter(row => row.locations && row.locations.includes(selectedLocation));
        }

        const unchecked = itemsInLoc.filter(row =>
            (!row.rawInput || String(row.rawInput).trim() === '') &&
            (!row.unopenedInput || String(row.unopenedInput).trim() === '')
        );

        if (unchecked.length > 0) {
            setUncheckedAlert({ show: true, items: unchecked, type: 'LOCATION' });
        } else {
            toast.success(`✅ Đã lưu tạm khu vực ${selectedLocation === 'All' ? 'Tất cả' : selectedLocation}!`);
        }
    };

    const confirmSaveLocation = () => {
        setUncheckedAlert({ show: false, items: [], type: '' });
        toast.success(`✅ Đã lưu tạm khu vực! Hàng thiếu đã được bỏ qua.`);
    };

    const handleGoToReview = () => {
        if (!checkerName.trim()) return toast.warn("Vui lòng nhập tên người đi kiểm!");
        setAllGridData(rowData);
        setReviewMode(true);
    };

    const handleFinalSubmit = () => {
        const submittedInputs = rowData
            .filter(row => (row.rawInput && String(row.rawInput).trim() !== '') || (row.unopenedInput && String(row.unopenedInput).trim() !== ''))
            .map(row => ({
                itemId: row.id,
                rawInput: String(row.rawInput || ''),
                unopenedInput: String(row.unopenedInput || ''),
                actualBaseWeight: row.actualBaseWeight ? parseFloat(row.actualBaseWeight) : null
            }));

        if (submittedInputs.length === 0) return toast.warn("Phiếu kiểm đồ hoàn toàn trống!");

        const payload = {
            sheetId: activeSheetId,
            checkDate: checkDate,
            checkerName: checkerName,
            inputs: submittedInputs,
            connectionId: hubConnection ? hubConnection.connectionId : null
        };

        if (!navigator.onLine) {
            saveToOfflineQueue(payload);
            setReviewMode(false);
        } else {
            axios.post(`${API_BASE_URL}/Inventory/daily`, payload)
                .then(() => {
                    toast.success("🚀 CHỐT SỔ THÀNH CÔNG TOÀN BỘ KHU VỰC!");
                    setReviewMode(false);
                })
                .catch(error => {
                    if (error.code === 'ERR_NETWORK') {
                        saveToOfflineQueue(payload);
                        setReviewMode(false);
                    } else {
                        toast.error("Lỗi khi lưu phiếu lên máy chủ!");
                    }
                });
        }
    };

    const handleExportExcel = async () => {
        if (!activeSheetId) return toast.warn("Vui lòng chọn tờ kiểm trước!");
        const toastId = toast.loading("⏳ Đang tạo báo cáo Excel...");

        try {
            const response = await axios.get(`${API_BASE_URL}/Inventory/export/${activeSheetId}`, { responseType: 'blob' });
            const fileName = `BaoCaoKiemDo_${activeSheetId}_${checkDate}.xlsx`;

            if (Capacitor.isNativePlatform()) {
                const reader = new FileReader();
                reader.readAsDataURL(response.data);
                reader.onloadend = async () => {
                    const base64Data = reader.result.split(',')[1];
                    try {
                        await Filesystem.writeFile({
                            path: fileName,
                            data: base64Data,
                            directory: Directory.Documents,
                        });
                        toast.update(toastId, { render: `✅ Đã lưu Excel vào thư mục Tài liệu (Documents)!`, type: "success", isLoading: false, autoClose: 5000 });
                    } catch (e) {
                        console.error("Lỗi lưu file:", e);
                        toast.update(toastId, { render: "🔴 Lỗi khi ghi file vào điện thoại!", type: "error", isLoading: false, autoClose: 3000 });
                    }
                };
            } else {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                toast.update(toastId, { render: "✅ Tải Excel thành công!", type: "success", isLoading: false, autoClose: 3000 });
            }
        } catch (error) {
            console.error("Lỗi xuất Excel:", error);
            toast.update(toastId, { render: "🔴 Lỗi khi tải file từ máy chủ!", type: "error", isLoading: false, autoClose: 3000 });
        }
    }

    const handleOpenAuditLog = async () => {
        if (!activeSheetId) return toast.warn("Vui lòng chọn tờ kiểm trước!");
        try {
            const res = await axios.get(`${API_BASE_URL}/Inventory/audit-logs/${activeSheetId}`);
            setAuditLogs(res.data);
            setShowAuditModal(true);
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi tải lịch sử hệ thống!");
        }
    }

    if (loading) return <h2 style={{ textAlign: 'center', marginTop: '50px' }}>Đang tải dữ liệu...</h2>

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '5px', boxSizing: 'border-box', position: 'relative' }}>

            {/* 🌟 MÁY TÍNH NỔI TOÀN CỤC (Tối ưu cảm ứng iOS & Android) */}
            {calcModal.isOpen && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
                }} onClick={() => setCalcModal(prev => ({ ...prev, isOpen: false }))}>

                    <div style={{
                        backgroundColor: '#fff', border: '2px solid #2196F3', borderRadius: '12px', padding: '20px', width: '300px', maxWidth: '90vw',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)', textAlign: 'left', boxSizing: 'border-box'
                    }} onClick={e => e.stopPropagation()}>

                        <div style={{ backgroundColor: '#e6f7ff', color: '#0050b3', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #91d5ff' }}>
                            <strong style={{ display: 'block', fontSize: '16px' }}>{calcModal.itemName}</strong>
                            <span style={{ fontSize: '13px' }}>Cột: {calcModal.colName}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                            <input
                                readOnly
                                value={calcModal.value}
                                style={{ flex: 1, padding: '12px', fontSize: '22px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'right', fontWeight: 'bold', color: '#1890ff', backgroundColor: '#fff', outline: 'none' }}
                            />
                            <button
                                type="button"
                                onClick={() => setCalcModal(prev => ({ ...prev, value: prev.value.slice(0, -1) }))}
                                style={{ padding: '0 15px', backgroundColor: '#fff1f0', color: '#cf1322', border: '1px solid #ffa39e', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px', touchAction: 'manipulation' }}
                            >
                                ⌫
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                            {['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '*', '0', '.', 'C', '/'].map(btn => (
                                <button
                                    key={btn}
                                    type="button"
                                    onClick={() => {
                                        if (btn === 'C') {
                                            setCalcModal(prev => ({ ...prev, value: '' }));
                                        } else {
                                            setCalcModal(prev => ({ ...prev, value: prev.value + btn }));
                                        }
                                    }}
                                    style={{
                                        padding: '15px 0', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                                        backgroundColor: ['+', '-', '*', '/'].includes(btn) ? '#e6f7ff' : btn === 'C' ? '#fff1f0' : '#f5f5f5',
                                        color: ['+', '-', '*', '/'].includes(btn) ? '#096dd9' : btn === 'C' ? '#cf1322' : '#333',
                                        border: '1px solid #ddd', borderRadius: '6px', userSelect: 'none', touchAction: 'manipulation'
                                    }}
                                >
                                    {btn}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveCalcValue}
                            style={{ width: '100%', padding: '14px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', touchAction: 'manipulation' }}
                        >
                            CHỐT SỐ (ENTER)
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL CẢNH BÁO CHƯA KIỂM HẾT ĐỒ */}
            {uncheckedAlert.show && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '450px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)', boxSizing: 'border-box'
                    }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#d32f2f', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                            ⚠️ PHÁT HIỆN HÀNG CHƯA KIỂM
                        </h3>
                        <p style={{ fontSize: '15px', color: '#333' }}>
                            Khu vực <strong style={{ color: '#2196F3' }}>{selectedLocation === 'All' ? 'Tất cả' : selectedLocation}</strong> hiện còn <strong>{uncheckedAlert.items.length}</strong> mặt hàng trống số liệu:
                        </p>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '1.6' }}>
                                {uncheckedAlert.items.map(item => (
                                    <li key={item.id}><strong>{item.itemName}</strong></li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button onClick={() => setUncheckedAlert({ show: false, items: [], type: '' })} style={{ padding: '10px 15px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>
                                ⬅ Bổ sung ngay
                            </button>
                            <button onClick={confirmSaveLocation} style={{ padding: '10px 15px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}>
                                Bỏ qua & Lưu tạm 💾
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AUDIT LOG */}
            {showAuditModal && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                }} onClick={() => setShowAuditModal(false)}>
                    <div style={{
                        backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '95%', maxWidth: '650px',
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', position: 'relative', boxSizing: 'border-box'
                    }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowAuditModal(false)} style={{
                            position: 'absolute', top: '10px', right: '10px', border: 'none', background: '#f5f5f5',
                            borderRadius: '50%', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', color: '#666'
                        }}>✖</button>
                        <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                            📜 Lịch sử thao tác (50 lượt gần nhất)
                        </h2>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ backgroundColor: '#f4f4f4', position: 'sticky', top: 0 }}>
                                    <tr style={{ textAlign: 'left' }}>
                                        <th>Thời gian</th>
                                        <th>Người sửa</th>
                                        <th>Mặt hàng</th>
                                        <th>Số liệu (Lẻ | Nguyên)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>Chưa có lịch sử nào.</td></tr>
                                    ) : (
                                        auditLogs.map(log => {
                                            const d = new Date(log.timestamp);
                                            const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} (${d.getDate()}/${d.getMonth() + 1})`;
                                            return (
                                                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ whiteSpace: 'nowrap', color: '#888', fontSize: '13px' }}>{timeStr}</td>
                                                    <td style={{ fontWeight: 'bold', color: '#1890ff' }}>{log.performedBy}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{log.itemName}</td>
                                                    <td style={{ backgroundColor: '#fffbe6' }}>{log.changedValue}</td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL THÔNG TIN SẢN PHẨM */}
            {showModal && selectedItemInfo && (
                <div style={{
                    position: 'fixed', inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        backgroundColor: 'white', padding: '20px', borderRadius: '12px', width: '85%', maxWidth: '350px',
                        textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', position: 'relative', boxSizing: 'border-box'
                    }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setShowModal(false)} style={{
                            position: 'absolute', top: '10px', right: '10px', border: 'none', background: '#f5f5f5',
                            borderRadius: '50%', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', color: '#666'
                        }}>✖</button>
                        <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>{selectedItemInfo.itemName}</h2>
                        {selectedItemInfo.imageUrl ? (
                            <img src={`${ROOT_URL}${selectedItemInfo.imageUrl}`} alt="img" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ddd' }} />
                        ) : (
                            <div style={{ width: '100%', height: '150px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#999' }}>📦 Chưa có hình ảnh</div>
                        )}
                        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                            <p style={{ margin: 0, fontSize: '15px', color: '#0050b3', fontWeight: 'bold' }}>
                                📍 Vị trí: {selectedItemInfo.locations?.length > 0 ? selectedItemInfo.locations.join(', ') : 'Chưa phân khu'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!activeSheetId ? (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h1 style={{ fontSize: '24px', margin: 0 }}>HỆ THỐNG KIỂM ĐỒ</h1>
                        <button onClick={handleLogout} style={{ padding: '8px 15px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Đăng xuất</button>
                    </div>
                    <p style={{ color: '#666', marginBottom: '20px' }}>Chọn một tờ kiểm bên dưới để bắt đầu</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {sheets?.map(sheet => (
                            <div key={sheet.id} style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => handleSheetClick(sheet.id)} style={{ flex: 1, padding: '15px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}>
                                    📝 {sheet.sheetName}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                !reviewMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '5px' }}>
                            <button onClick={() => setActiveSheetId(null)} style={{ padding: '8px 12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>⬅ Quay lại</button>
                            <button onClick={handleExportExcel} style={{ padding: '8px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>📊 Xuất Excel 7 Ngày</button>
                            <button onClick={handleOpenAuditLog} style={{ padding: '8px 12px', backgroundColor: '#607d8b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>📜 Lịch sử</button>
                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #2196F3', fontWeight: 'bold', color: '#2196F3', fontSize: '13px' }}
                            >
                                <option value="All">Tất cả khu vực</option>
                                {allLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '5px' }}>
                            <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} style={{ padding: '8px', flex: 1, borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px' }} />
                            <input
                                type="text"
                                placeholder="Người kiểm..."
                                value={checkerName}
                                onChange={(e) => setCheckerName(e.target.value)}
                                disabled={localStorage.getItem('role') === 'Employee'}
                                style={{ padding: '8px', flex: 1, borderRadius: '6px', border: '1px solid #bbb', fontSize: '13px', backgroundColor: localStorage.getItem('role') === 'Employee' ? '#e0e0e0' : 'white' }}
                            />
                        </div>

                        <div className="ag-theme-alpine" style={{ flex: 1, width: '100%', marginBottom: '10px' }}>
                            <AgGridReact
                                ref={gridRef}
                                rowData={filteredRowData}
                                columnDefs={columnDefs}
                                getRowId={params => String(params.data.id)}
                                rowHeight={45}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button onClick={handleSaveLocation} disabled={!isEditing} style={{ flex: 1, padding: '12px', backgroundColor: isEditing ? '#FF9800' : '#9e9e9e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: isEditing ? 'pointer' : 'not-allowed' }}>
                                💾 LƯU TẠM KHU VỰC
                            </button>
                            <button onClick={handleGoToReview} disabled={!isEditing} style={{ flex: 1, padding: '12px', backgroundColor: isEditing ? '#2196F3' : '#9e9e9e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: isEditing ? 'pointer' : 'not-allowed' }}>
                                📋 BẢNG TỔNG & CHỐT
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                        <h2 style={{ textAlign: 'center', color: '#1890ff', margin: '0 0 20px 0' }}>📋 BẢNG TỔNG HỢP CUỐI CÙNG</h2>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', backgroundColor: '#f0f5ff', padding: '15px', borderRadius: '8px' }}>
                            <div><strong>Người kiểm:</strong> {checkerName}</div>
                            <div><strong>Ngày kiểm:</strong> {new Date(checkDate).toLocaleDateString('vi-VN')}</div>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #eee' }}>
                            <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fafafa', boxShadow: '0 2px 2px rgba(0,0,0,0.1)' }}>
                                    <tr>
                                        <th style={{ padding: '12px' }}>Tên Hàng</th>
                                        <th>Khu Vực</th>
                                        <th>Hàng Lẻ</th>
                                        <th>Hàng Nguyên</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allGridData.map((item, index) => {
                                        const hasData = (item.rawInput && String(item.rawInput).trim() !== '') || (item.unopenedInput && String(item.unopenedInput).trim() !== '');
                                        return (
                                            <tr key={item.id} style={{ backgroundColor: hasData ? '#fffbe6' : '#fff' }}>
                                                <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>{index + 1}. {item.itemName}</td>
                                                <td style={{ fontSize: '12px', color: '#666' }}>{item.locations?.join(', ') || 'Chung'}</td>
                                                <td style={{ color: '#cf1322', fontWeight: 'bold', fontSize: '15px' }}>
                                                    {item.calculatedValue || '-'}
                                                </td>
                                                <td style={{ color: '#096dd9', fontWeight: 'bold', fontSize: '15px' }}>
                                                    {item.unopenedInput || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                            <button onClick={() => setReviewMode(false)} style={{ flex: 1, padding: '15px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                                ⬅ QUAY LẠI CHỈNH SỬA
                            </button>
                            <button onClick={handleFinalSubmit} style={{ flex: 2, padding: '15px', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                                🚀 XÁC NHẬN CHỐT SỔ
                            </button>
                        </div>
                    </div>
                )
            )}
        </div>
    )
}

export default Home