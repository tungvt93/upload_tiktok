import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, FileText, CheckCircle, XCircle, Search, ChevronDown } from 'lucide-react';

const SearchableProfileSelect = ({ profiles, selectedProfile, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredProfiles = profiles ? profiles.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
    const selectedObj = profiles?.find(p => p.id === selectedProfile);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div 
                className="input-field" 
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span style={{ color: selectedObj ? 'var(--text)' : 'var(--text-muted)' }}>
                    {selectedObj ? selectedObj.name : '-- Tìm kiếm và chọn Profile --'}
                </span>
                <ChevronDown size={16} />
            </div>
            
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md, 8px)',
                    zIndex: 50,
                    maxHeight: '250px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-card)'
                }}>
                    <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--input-bg)' }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input 
                            type="text" 
                            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, width: '100%', color: 'var(--text)' }}
                            placeholder="Nhập tên profile..."
                            value={searchQuery}
                            autoFocus
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div style={{ overflowY: 'auto' }}>
                        {filteredProfiles.map(p => (
                            <div 
                                key={p.id}
                                style={{ 
                                    padding: '0.75rem 1rem', 
                                    cursor: 'pointer',
                                    background: p.id === selectedProfile ? 'var(--surface-hover)' : 'transparent',
                                    color: p.id === selectedProfile ? 'var(--primary)' : 'var(--text)'
                                }}
                                onClick={() => {
                                    onChange(p.id);
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'var(--surface-hover)'}
                                onMouseLeave={(e) => e.target.style.background = p.id === selectedProfile ? 'var(--surface-hover)' : 'transparent'}
                            >
                                {p.name}
                            </div>
                        ))}
                        {filteredProfiles.length === 0 && (
                            <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Không tìm thấy profile nào</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const MusicCheckerView = ({ profiles }) => {
    const [selectedProfile, setSelectedProfile] = useState('');
    const [txtFilePath, setTxtFilePath] = useState('');
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (isModalOpen) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isModalOpen]);

    const handleSelectFile = async () => {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.selectFile({
                    title: 'Chọn file TXT chứa danh sách nhạc',
                    filters: [{ name: 'Text Files', extensions: ['txt'] }]
                });
                if (result && !result.canceled && result.filePaths.length > 0) {
                    setTxtFilePath(result.filePaths[0]);
                }
            } else {
                const p = window.prompt("Nhập đường dẫn file TXT tuyệt đối:");
                if (p) setTxtFilePath(p);
            }
        } catch (err) {
            console.error('File selection error:', err);
        }
    };

    const handleStart = async () => {
        if (!selectedProfile || !txtFilePath) {
            setError('Vui lòng chọn Profile và File TXT');
            return;
        }
        setError('');
        setIsLoading(true);
        setResults(null);
        setLogs([]);
        setIsModalOpen(true);

        try {
            // Using fetch for streaming response
            const res = await fetch('/api/check-music', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    profileId: selectedProfile,
                    txtFilePath
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Server error');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last partial line in the buffer
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.type === 'log') {
                            setLogs(prev => [...prev, parsed.message]);
                        } else if (parsed.type === 'done') {
                            if (parsed.success) {
                                setResults(parsed.results);
                            } else {
                                setError(parsed.error || 'Có lỗi xảy ra khi parse results');
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing line:', line, e);
                    }
                }
            }
            
            // Process any remaining buffer
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    if (parsed.type === 'log') setLogs(prev => [...prev, parsed.message]);
                    else if (parsed.type === 'done') {
                        if (parsed.success) setResults(parsed.results);
                        else setError(parsed.error);
                    }
                } catch (e) {}
            }

        } catch (err) {
            setError(err.message || 'Lỗi kết nối tới server');
            setLogs(prev => [...prev, `ERROR: ${err.message}`]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="view-container">
            <header className="view-header">
                <h2>Check Nhạc</h2>
                <p>Kiểm tra danh sách nhạc trong file txt xem có trên TikTok không</p>
            </header>

            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Chọn Profile chạy (Dùng để upload video):</label>
                        <SearchableProfileSelect 
                            profiles={profiles} 
                            selectedProfile={selectedProfile} 
                            onChange={setSelectedProfile} 
                        />
                    </div>

                    <div className="form-group">
                        <label>Đường dẫn File TXT:</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                                type="text" 
                                className="input-field" 
                                value={txtFilePath}
                                readOnly
                                placeholder="C:\path\to\music.txt"
                                style={{ flex: 1 }}
                            />
                            <button className="btn btn-secondary" onClick={handleSelectFile}>
                                <FileText size={16} /> Chọn File
                            </button>
                        </div>
                        <small>Định dạng mỗi dòng: Tên bài hát - Tên nhạc sĩ</small>
                    </div>

                    {error && !isModalOpen && <div style={{ color: 'var(--error)', padding: '0.5rem' }}>{error}</div>}

                    <div>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleStart} 
                            disabled={isLoading}
                        >
                            <Play size={16} /> Bắt đầu Check
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal hiển thị tiến trình và kết quả */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'var(--overlay)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div className="card" style={{ 
                        width: '100%', 
                        maxWidth: '800px', 
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isLoading ? <div className="spinner" style={{ width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <CheckCircle color="var(--success)" size={20} />}
                                {isLoading ? 'Đang kiểm tra nhạc...' : 'Đã kiểm tra xong'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ 
                                background: 'var(--bg-2)', 
                                padding: '1rem', 
                                borderRadius: 'var(--radius-sm)', 
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                color: 'var(--text-muted)',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}>
                                {logs.map((l, idx) => (
                                    <div key={idx} style={{ marginBottom: '4px', color: l.includes('ERROR') ? 'var(--error)' : 'inherit' }}>
                                        {l}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>

                            {error && <div style={{ color: 'var(--error)' }}>{error}</div>}

                            {results && (
                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: 'var(--text)' }}>Kết Quả Chi Tiết:</h4>
                                    {results.map((r, i) => (
                                        <div key={i} style={{ 
                                            padding: '1rem', 
                                            border: '1px solid var(--border)', 
                                            borderRadius: 'var(--radius-sm)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: r.match ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'
                                        }}>
                                            <div>
                                                <strong style={{ color: 'var(--text)' }}>Dòng {i+1}:</strong> <span style={{ color: 'var(--text-muted)' }}>{r.line}</span>
                                                {r.foundTitle && (
                                                    <div style={{ fontSize: '0.85em', marginTop: '0.4rem', color: 'var(--text)' }}>
                                                        Tìm được: <strong>{r.foundTitle}</strong> - {r.foundArtist}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                {r.match ? 
                                                    <CheckCircle color="var(--success)" size={24} /> : 
                                                    <XCircle color="var(--error)" size={24} />
                                                }
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MusicCheckerView;
