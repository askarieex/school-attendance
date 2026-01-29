import React, { useState, useEffect, useCallback } from 'react';
import {
    FiMessageCircle,
    FiPlus,
    FiAlertTriangle,
    FiRefreshCw,
    FiToggleLeft,
    FiToggleRight,
    FiDollarSign,
    FiClock,
    FiKey,
    FiCheck,
    FiX
} from 'react-icons/fi';
import { whatsappCreditsAPI } from '../utils/api';

const WhatsAppManagement = () => {
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [lowCreditSchools, setLowCreditSchools] = useState([]);

    // Add credits modal
    const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [creditsToAdd, setCreditsToAdd] = useState(100);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // API Key modal
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [apiKeySchool, setApiKeySchool] = useState(null);
    const [apiKeyInput, setApiKeyInput] = useState('');

    // Fetch all data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [schoolsRes, statsRes, lowCreditRes] = await Promise.all([
                whatsappCreditsAPI.getAllSchools(),
                whatsappCreditsAPI.getStats(),
                whatsappCreditsAPI.getLowCreditSchools()
            ]);

            setSchools(schoolsRes.data || []);
            setStats(statsRes.data || {});
            setLowCreditSchools(lowCreditRes.data || []);
        } catch (error) {
            console.error('Failed to fetch WhatsApp data:', error);
            alert('Failed to load WhatsApp data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Toggle WhatsApp enabled/disabled
    const handleToggleEnabled = async (school) => {
        const newStatus = !school.whatsapp_enabled;
        try {
            await whatsappCreditsAPI.setEnabled(school.id, newStatus);
            setSchools(schools.map(s =>
                s.id === school.id ? { ...s, whatsapp_enabled: newStatus } : s
            ));
        } catch (error) {
            console.error('Failed to toggle WhatsApp status:', error);
            alert('Failed to update status');
        }
    };

    // Open add credits modal
    const openAddCreditsModal = (school) => {
        setSelectedSchool(school);
        setCreditsToAdd(100);
        setShowAddCreditsModal(true);
    };

    // Submit add credits
    const handleAddCredits = async () => {
        if (!selectedSchool || creditsToAdd <= 0) return;

        setIsSubmitting(true);
        try {
            const result = await whatsappCreditsAPI.addCredits(selectedSchool.id, creditsToAdd);
            setSchools(schools.map(s =>
                s.id === selectedSchool.id ? {
                    ...s,
                    whatsapp_credits: result.data.whatsapp_credits,
                    whatsapp_last_refill: result.data.whatsapp_last_refill
                } : s
            ));
            setShowAddCreditsModal(false);
            alert(`Added ${creditsToAdd} credits to ${selectedSchool.name}`);
            fetchData(); // Refresh stats
        } catch (error) {
            console.error('Failed to add credits:', error);
            alert('Failed to add credits');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open API key modal
    const openApiKeyModal = (school) => {
        setApiKeySchool(school);
        setApiKeyInput('');
        setShowApiKeyModal(true);
    };

    // Submit API key
    const handleSetApiKey = async () => {
        if (!apiKeySchool) return;

        setIsSubmitting(true);
        try {
            const result = await whatsappCreditsAPI.setApiKey(apiKeySchool.id, apiKeyInput, true);
            setSchools(schools.map(s =>
                s.id === apiKeySchool.id ? {
                    ...s,
                    has_own_api_key: result.data.has_own_api_key,
                    whatsapp_use_own_key: result.data.whatsapp_use_own_key
                } : s
            ));
            setShowApiKeyModal(false);
            alert(result.message);
        } catch (error) {
            console.error('Failed to set API key:', error);
            alert('Failed to set API key');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Clear API key (use master)
    const handleClearApiKey = async () => {
        if (!apiKeySchool) return;

        setIsSubmitting(true);
        try {
            const result = await whatsappCreditsAPI.setApiKey(apiKeySchool.id, '', false);
            setSchools(schools.map(s =>
                s.id === apiKeySchool.id ? {
                    ...s,
                    has_own_api_key: false,
                    whatsapp_use_own_key: false
                } : s
            ));
            setShowApiKeyModal(false);
            alert(result.message);
        } catch (error) {
            console.error('Failed to clear API key:', error);
            alert('Failed to clear API key');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FiMessageCircle color="#25D366" />
                        WhatsApp Credit Management
                    </h1>
                    <p style={{ color: '#64748b' }}>Manage WhatsApp message credits and API keys for all schools</p>
                </div>
                <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
                    <FiRefreshCw className={loading ? 'spinning' : ''} /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', color: 'white' }}>
                        <div style={{ fontSize: '13px', opacity: 0.9 }}>Enabled Schools</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.enabled_schools || 0}</div>
                    </div>
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Disabled Schools</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.disabled_schools || 0}</div>
                    </div>
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Total Credits Remaining</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#16a34a' }}>{stats.total_credits_remaining || 0}</div>
                    </div>
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Total Credits Used</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0891b2' }}>{stats.total_credits_used || 0}</div>
                    </div>
                </div>
            )}

            {/* Low Credits Alert */}
            {lowCreditSchools.length > 0 && (
                <div className="card" style={{
                    padding: '16px 20px',
                    marginBottom: '24px',
                    background: '#fef3c7',
                    border: '1px solid #fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FiAlertTriangle size={24} color="#d97706" />
                    <div>
                        <strong style={{ color: '#92400e' }}>Low Credits Alert!</strong>
                        <span style={{ color: '#92400e', marginLeft: '8px' }}>
                            {lowCreditSchools.length} school(s) have low WhatsApp credits and need refill.
                        </span>
                    </div>
                </div>
            )}

            {/* Schools Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>School Name</th>
                                <th>WhatsApp Status</th>
                                <th>API Key</th>
                                <th>Credits</th>
                                <th>Used</th>
                                <th>Last Refill</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        No schools found.
                                    </td>
                                </tr>
                            ) : (
                                schools.map((school) => {
                                    const isLowCredit = school.whatsapp_enabled &&
                                        school.whatsapp_credits <= (school.whatsapp_low_credit_threshold || 50);

                                    return (
                                        <tr key={school.id} style={{
                                            background: isLowCredit ? '#fef3c7' : 'transparent'
                                        }}>
                                            <td>
                                                <div style={{ fontWeight: '600' }}>{school.name}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{school.email}</div>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleToggleEnabled(school)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '8px 16px',
                                                        border: 'none',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        fontWeight: '600',
                                                        fontSize: '13px',
                                                        background: school.whatsapp_enabled ? '#dcfce7' : '#f1f5f9',
                                                        color: school.whatsapp_enabled ? '#16a34a' : '#64748b',
                                                    }}
                                                >
                                                    {school.whatsapp_enabled ? (
                                                        <>
                                                            <FiToggleRight size={18} />
                                                            Active
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FiToggleLeft size={18} />
                                                            Inactive
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => openApiKeyModal(school)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        background: school.has_own_api_key ? '#dbeafe' : 'white',
                                                        color: school.has_own_api_key ? '#1d4ed8' : '#64748b',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    <FiKey size={14} />
                                                    {school.has_own_api_key ? 'Own Key' : 'Master Key'}
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontWeight: '600',
                                                    color: isLowCredit ? '#d97706' : '#16a34a'
                                                }}>
                                                    {isLowCredit && <FiAlertTriangle size={16} />}
                                                    {school.whatsapp_credits || 0}
                                                </div>
                                            </td>
                                            <td style={{ color: '#64748b' }}>
                                                {school.whatsapp_credits_used || 0}
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#64748b' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <FiClock size={14} />
                                                    {formatDate(school.whatsapp_last_refill)}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-primary"
                                                    style={{ padding: '8px 16px', fontSize: '13px' }}
                                                    onClick={() => openAddCreditsModal(school)}
                                                >
                                                    <FiPlus size={14} /> Add Credits
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Credits Modal */}
            {showAddCreditsModal && selectedSchool && (
                <div className="modal-overlay" onClick={() => setShowAddCreditsModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FiDollarSign color="#16a34a" />
                            Add Credits
                        </h2>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>
                            Top up WhatsApp credits for <strong>{selectedSchool.name}</strong>
                        </p>

                        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#64748b' }}>Current Credits:</span>
                                <span style={{ fontWeight: '600' }}>{selectedSchool.whatsapp_credits || 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Total Used:</span>
                                <span style={{ fontWeight: '600' }}>{selectedSchool.whatsapp_credits_used || 0}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                Credits to Add *
                            </label>
                            <input
                                type="number"
                                className="input"
                                min="1"
                                value={creditsToAdd}
                                onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        {/* Quick add buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            {[100, 500, 1000, 2000, 5000].map(amount => (
                                <button
                                    key={amount}
                                    type="button"
                                    onClick={() => setCreditsToAdd(amount)}
                                    style={{
                                        padding: '8px 16px',
                                        border: creditsToAdd === amount ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        background: creditsToAdd === amount ? '#e0f2fe' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                    }}
                                >
                                    +{amount}
                                </button>
                            ))}
                        </div>

                        <div style={{
                            background: '#dcfce7',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#166534' }}>New Balance After Top-up:</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>
                                {(selectedSchool.whatsapp_credits || 0) + creditsToAdd}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowAddCreditsModal(false)}
                                style={{ flex: 1 }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAddCredits}
                                style={{ flex: 1 }}
                                disabled={isSubmitting || creditsToAdd <= 0}
                            >
                                {isSubmitting ? 'Adding...' : `Add ${creditsToAdd} Credits`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* API Key Modal */}
            {showApiKeyModal && apiKeySchool && (
                <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FiKey color="#0ea5e9" />
                            API Key Settings
                        </h2>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>
                            Configure YCloud API key for <strong>{apiKeySchool.name}</strong>
                        </p>

                        {/* Current Status */}
                        <div style={{
                            background: apiKeySchool.has_own_api_key ? '#dbeafe' : '#f8fafc',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                            border: apiKeySchool.has_own_api_key ? '1px solid #3b82f6' : '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                {apiKeySchool.has_own_api_key ? (
                                    <FiCheck color="#16a34a" size={18} />
                                ) : (
                                    <FiX color="#64748b" size={18} />
                                )}
                                <span style={{ fontWeight: '600', color: apiKeySchool.has_own_api_key ? '#1d4ed8' : '#475569' }}>
                                    {apiKeySchool.has_own_api_key ? 'Using Own API Key' : 'Using Master API Key'}
                                </span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                                {apiKeySchool.has_own_api_key
                                    ? 'This school is using their own YCloud account for WhatsApp messages.'
                                    : 'This school is using your master YCloud API key.'}
                            </p>
                        </div>

                        {/* API Key Input */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                                School's YCloud API Key
                            </label>
                            <input
                                type="password"
                                className="input"
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="Enter school's YCloud API Key..."
                                style={{ fontFamily: 'monospace' }}
                            />
                            <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>
                                Leave empty and click "Use Master Key" to use your master API key
                            </small>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowApiKeyModal(false)}
                                style={{ flex: 1 }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            {apiKeySchool.has_own_api_key && (
                                <button
                                    className="btn"
                                    onClick={handleClearApiKey}
                                    style={{ flex: 1, background: '#f1f5f9', color: '#475569' }}
                                    disabled={isSubmitting}
                                >
                                    Use Master Key
                                </button>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={handleSetApiKey}
                                style={{ flex: 1 }}
                                disabled={isSubmitting || !apiKeyInput.trim()}
                            >
                                {isSubmitting ? 'Saving...' : 'Set Own Key'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default WhatsAppManagement;
