"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Square, Bot, User, Menu, Plus, Trash2, LogOut, X, Lock } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  personality: 'ramah' | 'pemarah';
  translation_lang: 'indonesia' | 'inggris';
  learning_mode: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function Home() {
  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Application State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // UI State
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Initialize Auth
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('username');
    if (savedToken) {
      setToken(savedToken);
      setLoggedInUser(savedUser);
      setIsAuthModalOpen(false);
    }
  }, []);

  // Fetch Conversations when token changes
  useEffect(() => {
    if (token) {
      fetchConversations();
    } else if (!isAuthModalOpen) {
      // If continuing as guest, generate one fresh local chat layout but it will be attached to guest DB under the hood
      if (conversations.length === 0) {
        createNewConversation();
      }
    }
  }, [token, isAuthModalOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setLoggedInUser(null);
    setConversations([]);
    setActiveId(null);
    setIsAuthModalOpen(true);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    
    try {
      if (authMode === 'register') {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.detail || "Registration failed");
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        setToken(data.access_token);
        setLoggedInUser(data.username);
        setIsAuthModalOpen(false);
        setConversations([]); // reset before fetch
      } else {
        const formParams = new URLSearchParams();
        formParams.append('username', username);
        formParams.append('password', password);
        
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.detail || "Login failed");
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        setToken(data.access_token);
        setLoggedInUser(data.username);
        setIsAuthModalOpen(false);
        setConversations([]); // reset before fetch
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    const res = await fetch(url, { ...options, headers });
    // Only logout if they had a token but it was invalid
    if (res.status === 401 && token) {
      handleLogout();
    }
    return res;
  };

  const fetchConversations = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/conversations`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
          if (data.length > 0 && !activeId) {
            setActiveId(data[0].id);
          } else if (data.length === 0) {
            createNewConversation();
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch conversations", e);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeId);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  const createNewConversation = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/conversations`, { method: 'POST' });
      if (res.ok) {
        const newConv = await res.json();
        setConversations(prev => [newConv, ...prev]);
        setActiveId(newConv.id);
        if(window.innerWidth <= 800) setIsSidebarOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetchWithAuth(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => {
          const filtered = prev.filter(c => c.id !== id);
          if (activeId === id) {
            if (filtered.length > 0) setActiveId(filtered[0].id);
            else {
              setActiveId(null);
              setTimeout(() => createNewConversation(), 0);
            }
          }
          if (filtered.length === 0 && activeId !== id) {
            setTimeout(() => createNewConversation(), 0);
          }
          return filtered;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateActiveSetting = async (key: 'personality' | 'translation_lang' | 'title' | 'learning_mode', value: string | boolean) => {
    if (!activeId) return;
    
    // Optimistic UI update
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, [key]: value } : c));
    
    // Send to DB
    try {
      await fetchWithAuth(`${API_BASE}/conversations/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
    } catch (e) {
      console.error("Failed to update setting", e);
    }
  };

  const addMessage = (sender: 'user' | 'ai', text: string) => {
    if (!activeId) return;
    
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        return {
          ...c,
          messages: [...c.messages, { id: Math.random().toString(36).substring(2, 9), sender, text }]
        };
      }
      return c;
    }));
  };

  const renderFuriganaText = (text: string) => {
    const regex = /【([^】|]+)\|([^】|]+)】/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
      }
      elements.push(
        <ruby key={`r-${match.index}`}>
          {match[1]}<rt>{match[2]}</rt>
        </ruby>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      elements.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }
    return elements.length > 0 ? elements : text;
  };

  const handleSendText = async () => {
    if (!inputText.trim() || !activeConversation) return;
    
    const textToSend = inputText;
    setInputText('');
    
    if (activeConversation.messages.length === 0) {
      const generatedTitle = textToSend.slice(0, 30) + (textToSend.length > 30 ? '...' : '');
      updateActiveSetting('title', generatedTitle);
    }
    
    addMessage('user', textToSend);
    
    const formData = new FormData();
    formData.append('text', textToSend);
    formData.append('personality', activeConversation.personality);
    formData.append('translation_lang', activeConversation.translation_lang);
    formData.append('conversation_id', activeConversation.id);

    await sendToBackend(formData);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!activeConversation) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice_record.webm');
          formData.append('personality', activeConversation.personality);
          formData.append('translation_lang', activeConversation.translation_lang);
          formData.append('conversation_id', activeConversation.id);
          
          await sendToBackend(formData);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Mohon izinkan akses mikrofon untuk memakai fitur suara.");
      }
    }
  };

  const sendToBackend = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/chat`, {
        method: 'POST',
        // FormData doesn't need Content-Type, fetch sets multipart/form-data boundary automatically
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Gagal terhubung ke server backend.");
      }

      const data = await res.json();
      
      if (formData.has('audio')) {
        const cid = activeId;
        setConversations(prev => prev.map(c => {
          if (c.id === cid && c.messages.length === 0) {
            updateActiveSetting('title', data.user_text.substring(0, 30));
          }
          return c;
        }));
        addMessage('user', data.user_text);
      }

      addMessage('ai', data.ai_text);

    } catch (error: any) {
      console.error(error);
      addMessage('ai', `Error: ${error.message || "Something went wrong."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendText();
    }
  };

  return (
    <>
      {/* Authentication Modal Popup */}
      {isAuthModalOpen && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <button 
              onClick={() => setIsAuthModalOpen(false)}
              style={{position: 'absolute', right: '15px', top: '15px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer'}}
            >
              <X size={20} />
            </button>
            <div className="auth-header">
              <h2>Nihongo AI</h2>
              <p>{authMode === 'login' ? 'Login to continue your learning journey' : 'Create an account to start chatting'}</p>
            </div>
            
            <form onSubmit={handleAuth} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <div className="auth-form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  className="auth-input" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="e.g. naruto123"
                />
              </div>
              <div className="auth-form-group">
                <label>Password</label>
                <input 
                  type="password" 
                  className="auth-input" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              
              {authError && <div className="auth-error">{authError}</div>}
              
              <button type="submit" className="auth-submit-btn" disabled={isAuthLoading}>
                {isAuthLoading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Register')}
              </button>
            </form>
            
            <div className="auth-toggle-text">
              {authMode === 'login' ? (
                <>Don't have an account? <span className="auth-toggle-link" onClick={() => {setAuthMode('register'); setAuthError('');}}>Sign Up</span></>
              ) : (
                <>Already have an account? <span className="auth-toggle-link" onClick={() => {setAuthMode('login'); setAuthError('');}}>Sign In</span></>
              )}
            </div>

            <div style={{textAlign: 'center', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid var(--border-color)'}}>
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                style={{background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline'}}
              >
                Lanjutkan sebagai Tamu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Application */}
      <div className="layout-wrapper" style={{ filter: isAuthModalOpen ? 'blur(5px)' : 'none', pointerEvents: isAuthModalOpen ? 'none' : 'auto' }}>
        <div 
          className={`overlay ${isSidebarOpen ? 'show' : ''}`} 
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Sidebar Area */}
        <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          {token ? (
            <>
              <div className="sidebar-header" style={{ display: 'flex', gap: '10px' }}>
                <button className="new-chat-btn" onClick={createNewConversation} style={{flex: 1}}>
                  <Plus size={18} /> New Chat
                </button>
              </div>
              <div className="history-list">
                {conversations.map(conv => (
                  <div 
                    key={conv.id} 
                    className={`history-item ${activeId === conv.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveId(conv.id);
                      if(window.innerWidth <= 800) setIsSidebarOpen(false);
                    }}
                  >
                    <div className="title">{conv.title}</div>
                    <button 
                      className="delete-btn" 
                      onClick={(e) => deleteConversation(conv.id, e)}
                      title="Delete Chat"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>
                  <User size={14} style={{display:'inline', marginRight:'6px'}}/>
                  {loggedInUser}
                </span>
                <button onClick={handleLogout} style={{background:'transparent', border:'none', color:'var(--text-secondary)', cursor:'pointer'}} title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center'}}>
              <Lock size={40} color="var(--text-secondary)" style={{marginBottom: '15px'}} />
              <h3 style={{color: 'var(--text-primary)', marginBottom: '10px'}}>Mode Tamu</h3>
              <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px'}}>Riwayat percakapan tidak disimpan untuk tamu.</p>
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="new-chat-btn"
                style={{justifyContent: 'center', background: 'var(--accent-blue)', color: '#000'}}
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="app-container">
          <audio ref={audioPlayerRef} style={{ display: 'none' }} />

          <div className="header">
            <h1 style={{ display: 'flex', alignItems: 'center' }}>
              <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu size={24} />
              </button>
              <Bot size={24} color="#00d2ff" style={{marginRight: 8}}/>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-pink))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
                Nihongo AI
              </span>
            </h1>
            
            {activeConversation ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                {!token && (
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    style={{padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem'}}
                  >
                    Login
                  </button>
                )}
                <div className="personality-toggle">
                  <button 
                    className={`toggle-btn ramah ${activeConversation.translation_lang === 'indonesia' ? 'active' : ''}`}
                    onClick={() => updateActiveSetting('translation_lang', 'indonesia')}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    ID 🇮🇩
                  </button>
                  <button 
                    className={`toggle-btn pemarah ${activeConversation.translation_lang === 'inggris' ? 'active' : ''}`}
                    onClick={() => updateActiveSetting('translation_lang', 'inggris')}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    EN 🇺🇸
                  </button>
                </div>
                
                <div className="personality-toggle">
                  <button 
                    className={`toggle-btn ramah ${activeConversation.personality === 'ramah' ? 'active' : ''}`}
                    onClick={() => updateActiveSetting('personality', 'ramah')}
                  >
                    Ramah 😊
                  </button>
                  <button 
                    className={`toggle-btn pemarah ${activeConversation.personality === 'pemarah' ? 'active' : ''}`}
                    onClick={() => updateActiveSetting('personality', 'pemarah')}
                  >
                    Pemarah 😠
                  </button>
                </div>

                <div className="personality-toggle" title={!token ? "Login required" : ""}>
                  <button 
                    className={`toggle-btn ramah ${activeConversation.learning_mode ? 'active' : ''}`}
                    onClick={() => {
                        if (!token) return setIsAuthModalOpen(true);
                        updateActiveSetting('learning_mode', !activeConversation.learning_mode);
                    }}
                    style={{ opacity: !token ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Mode Belajar 🎓
                  </button>
                </div>
              </div>
            ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {!token && (
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      style={{padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8rem'}}
                    >
                      Login
                    </button>
                  )}
                </div>
            )}
          </div>

          <div className="chat-area">
            {(!activeConversation || activeConversation.messages.length === 0) && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 'auto', marginBottom: 'auto' }}>
                <p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Konnichiwa{loggedInUser ? `, ${loggedInUser}` : ''}! 👋</p>
                <p>{loggedInUser ? 'Mulai percakapan baru. Riwayat Anda akan tersimpan aman dengan akun Anda.' : 'Anda masuk sebagai Tamu. Riwayat tidak akan disimpan permanen.'}</p>
              </div>
            )}

            {activeConversation?.messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                <div className="message-meta">
                  {msg.sender === 'user' ? (
                    <><User size={14} /> Kamu</>
                  ) : (
                    <><Bot size={14} /> AI Sensei</>
                  )}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.sender === 'ai' ? renderFuriganaText(msg.text) : msg.text}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message ai">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <div className="input-container">
              <input 
                type="text" 
                className="text-input" 
                placeholder="Ketik balasan Anda disini..." 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isRecording || !activeConversation}
              />
              {inputText.trim() ? (
                <button className="action-btn send" onClick={handleSendText} disabled={isLoading || !activeConversation}>
                  <Send size={20} />
                </button>
              ) : (
                <button 
                  className={`action-btn mic ${isRecording ? 'recording' : ''}`} 
                  onClick={toggleRecording}
                  disabled={isLoading || !activeConversation}
                  title={isRecording ? "Stop Recording" : "Tap to Speak"}
                >
                  {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
