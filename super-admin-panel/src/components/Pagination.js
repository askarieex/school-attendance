import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    hasNextPage,
    hasPrevPage,
    loading
}) => {
    // If specific next/prev flags are provided, use them. 
    // Otherwise fall back to calculating based on totalPages
    const canGoBack = hasPrevPage !== undefined ? hasPrevPage : currentPage > 1;
    const canGoForward = hasNextPage !== undefined ? hasNextPage : currentPage < totalPages;

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '16px'
        }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>
                Page {currentPage} {totalPages ? `of ${totalPages}` : ''}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    disabled={!canGoBack || loading}
                    onClick={() => onPageChange(currentPage - 1)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: (!canGoBack || loading) ? 'not-allowed' : 'pointer',
                        opacity: (!canGoBack || loading) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <FiChevronLeft />
                </button>
                <button
                    disabled={!canGoForward || loading}
                    onClick={() => onPageChange(currentPage + 1)}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: (!canGoForward || loading) ? 'not-allowed' : 'pointer',
                        opacity: (!canGoForward || loading) ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <FiChevronRight />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
