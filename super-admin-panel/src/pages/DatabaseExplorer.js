import React, { useState, useEffect } from 'react';
import { databaseAPI } from '../utils/api';
import { FiDatabase, FiSearch, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';

const DatabaseExplorer = () => {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [total, setTotal] = useState(0);

    // Fetch tables on mount
    useEffect(() => {
        fetchTables();
    }, []);

    // Fetch data when table or page changes
    useEffect(() => {
        if (selectedTable) {
            fetchTableData(selectedTable, page);
        }
    }, [selectedTable, page]);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const data = await databaseAPI.getTables();
            setTables(data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load tables');
            setLoading(false);
        }
    };

    const fetchTableData = async (tableName, pageNum) => {
        try {
            setLoading(true);
            setError(null);
            const response = await databaseAPI.getTableData(tableName, { page: pageNum, limit });
            setTableData(response.data);
            setTotal(response.total);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load table data');
            setLoading(false);
        }
    };

    const handleTableSelect = (tableName) => {
        setSelectedTable(tableName);
        setPage(1); // Reset to first page
        setSearchTerm('');
    };

    const filteredTables = tables.filter(t =>
        t.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="database-explorer" style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: '20px' }}>
            {/* Sidebar: Table List */}
            <div className="card" style={{ width: '250px', display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px' }}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiDatabase /> Tables
                </h3>

                <div style={{ position: 'relative', marginBottom: '16px' }}>
                    <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search tables..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 8px 8px 36px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px'
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredTables.map(table => (
                        <button
                            key={table}
                            onClick={() => handleTableSelect(table)}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                background: selectedTable === table ? '#e0f2fe' : 'transparent',
                                color: selectedTable === table ? '#0284c7' : '#475569',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginBottom: '4px',
                                fontWeight: selectedTable === table ? '600' : '400'
                            }}
                        >
                            {table}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content: Data Grid */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '12px', overflow: 'hidden' }}>
                {!selectedTable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <FiDatabase size={48} style={{ marginBottom: '16px' }} />
                        <p>Select a table to view data</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{selectedTable}</h2>
                                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{total} records found</span>
                            </div>
                            <button
                                onClick={() => fetchTableData(selectedTable, page)}
                                className="btn btn-secondary"
                                style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <FiRefreshCw className={loading ? 'spin' : ''} /> Refresh
                            </button>
                        </div>

                        {error && (
                            <div style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: '6px', marginBottom: '16px' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                        {tableData.length > 0 && Object.keys(tableData[0]).map(key => (
                                            <th key={key} style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            {Object.values(row).map((val, j) => (
                                                <td key={j} style={{ padding: '12px', color: '#334155', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {tableData.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="100%" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                                No records found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                            <span style={{ fontSize: '14px', color: '#64748b' }}>
                                Page {page} of {totalPages || 1}
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    disabled={page === 1 || loading}
                                    onClick={() => setPage(page - 1)}
                                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                                >
                                    <FiChevronLeft />
                                </button>
                                <button
                                    disabled={page >= totalPages || loading}
                                    onClick={() => setPage(page + 1)}
                                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
                                >
                                    <FiChevronRight />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DatabaseExplorer;
