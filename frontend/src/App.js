import React, { useState, useEffect, useRef } from 'react';
import { Calendar, TrendingUp, Lock, BarChart3, Plus, Save, Eye, Trash2, Home, BookOpen, LineChart, Shield, LogOut, User, Mic, MicOff, Download, Search, CalendarDays, FileDown } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const App = () => {
  const [currentView, setCurrentView] = useState('login');
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState('');
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const entryRef = useRef(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const searchDebounceRef = useRef(null);
  
  // Calendar state
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
  // Auth states
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({
    username: '',
    email: '',
    password: ''
  });
  
  // Vault states
  const [vaultPassword, setVaultPassword] = useState('');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultSetup, setVaultSetup] = useState({
    password: '',
    confirmPassword: ''
  });
  const vaultPasswordRef = useRef(null);
  const vaultSetupPasswordRef = useRef(null);
  const vaultSetupConfirmRef = useRef(null);
  
  // Check authentication
  useEffect(() => {
    if (token) {
      fetchUserData();
      setCurrentView('home');
    }
  }, [token]);

  // Refetch calendar when month changes
  useEffect(() => {
    if (token) {
      fetchCalendarData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);
  
  // Search filter effect (also re-run when entries change)
  useEffect(() => {
    const q = (searchRef.current && searchRef.current.value) || searchQuery || '';
    if (q.trim() === '') {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter(entry => entry.content.toLowerCase().includes(q.toLowerCase()));
      setFilteredEntries(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);
  
  // Fetch user data
  const fetchUserData = async () => {
    try {
      const response = await fetch(`${API_URL}/entries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
        setFilteredEntries(data.entries);
        fetchAnalytics();
        fetchCalendarData();
      } else {
        // Keep the user logged in; show an error instead of logging out
        setError('Failed to load entries. Please try again.');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('Network error while loading entries.');
    }
  };
  
  // Fetch calendar data
  const fetchCalendarData = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      
      const response = await fetch(`${API_URL}/entries/calendar?year=${year}&month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCalendarData(data.calendar);
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
    }
  };
  
  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_URL}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };
  
  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const formValues = {
      username: usernameRef.current ? usernameRef.current.value : authData.username,
      email: emailRef.current ? emailRef.current.value : authData.email,
      password: passwordRef.current ? passwordRef.current.value : authData.password,
    };
    const body = authMode === 'login' 
      ? { email: formValues.email, password: formValues.password }
      : formValues;
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        setCurrentView('home');
        fetchUserData();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (error) {
      setError('Server error. Make sure backend is running on port 5000');
    }
    
    setLoading(false);
  };
  
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setCurrentView('login');
    setEntries([]);
    setAnalytics(null);
  };
  
  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioURL(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      alert('Microphone access denied. Please allow microphone access.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };
  
  const saveVoiceEntry = async () => {
    if (!audioBlob) {
      alert('Please record audio first');
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-entry.webm');
    formData.append('transcription', currentEntry || '[Voice entry]');
    
    try {
      const response = await fetch(`${API_URL}/entries/voice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Voice entry saved! ${data.entry.sentiment.feedback}`);
        setCurrentEntry('');
        setAudioBlob(null);
        setAudioURL(null);
        setRecordingTime(0);
        fetchUserData();
      } else {
        alert('Failed to save voice entry');
      }
    } catch (error) {
      alert('Error saving voice entry. Check if backend is running.');
    }
    setLoading(false);
  };
  
  // Text entry handler
  const saveEntry = async () => {
    const text = entryRef.current ? entryRef.current.value : currentEntry;
    if (!text || !text.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: text })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Entry saved! ${data.entry.sentiment.feedback}`);
        if (entryRef.current) entryRef.current.value = '';
        setCurrentEntry('');
        fetchUserData();
      } else {
        alert('Failed to save entry');
      }
    } catch (error) {
      alert('Error saving entry. Check if backend is running.');
    }
    setLoading(false);
  };
  
  // Delete entry
  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    
    try {
      const response = await fetch(`${API_URL}/entries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchUserData();
      }
    } catch (error) {
      alert('Error deleting entry');
    }
  };
  
  // Export to PDF (simplified - creates downloadable JSON)
  const exportEntries = async () => {
    try {
      const response = await fetch(`${API_URL}/entries/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Create a formatted text version
        let exportText = `ETERNA JOURNAL EXPORT\n`;
        exportText += `Export Date: ${new Date(data.exportDate).toLocaleString()}\n`;
        exportText += `Total Entries: ${data.totalEntries}\n`;
        exportText += `User: ${user?.username || 'Anonymous'}\n\n`;
        exportText += `${'='.repeat(80)}\n\n`;
        
        data.entries.forEach((entry, index) => {
          exportText += `ENTRY #${index + 1}\n`;
          exportText += `Date: ${new Date(entry.created_at).toLocaleString()}\n`;
          exportText += `Type: ${entry.entry_type}\n`;
          exportText += `\nContent:\n${entry.content}\n\n`;
          exportText += `Emotions:\n`;
          exportText += `  Joy: ${entry.sentiment.joy}%\n`;
          exportText += `  Sadness: ${entry.sentiment.sadness}%\n`;
          exportText += `  Anxiety: ${entry.sentiment.anxiety}%\n`;
          exportText += `  Anger: ${entry.sentiment.anger}%\n`;
          exportText += `\nAI Feedback: ${entry.sentiment.feedback}\n`;
          exportText += `\n${'-'.repeat(80)}\n\n`;
        });
        
        // Create download link (delay revocation to avoid file-not-found on some browsers)
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eterna-journal-export-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        
        alert('Entries exported successfully!');
      } else {
        const errText = await response.text();
        alert(`Failed to export entries. ${errText || ''}`);
      }
    } catch (error) {
      alert('Error exporting entries');
    }
  };
  
  // Vault handlers
  const setupVault = async () => {
    const pass = vaultSetupPasswordRef.current ? vaultSetupPasswordRef.current.value : vaultSetup.password;
    const confirm = vaultSetupConfirmRef.current ? vaultSetupConfirmRef.current.value : vaultSetup.confirmPassword;
    if (pass !== confirm) {
      alert('Passwords do not match');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/vault/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          vaultPassword: pass,
          legacyContacts: [],
          unlockRules: {}
        })
      });
      
      if (response.ok) {
        alert('Vault configured successfully!');
        setVaultSetup({ password: '', confirmPassword: '' });
      }
    } catch (error) {
      alert('Error setting up vault');
    }
  };
  
  const unlockVault = async () => {
    const pass = vaultPasswordRef.current ? vaultPasswordRef.current.value : vaultPassword;
    try {
      const response = await fetch(`${API_URL}/vault/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vaultPassword: pass })
      });
      
      if (response.ok) {
        setIsVaultUnlocked(true);
        alert('Vault unlocked!');
      } else {
        alert('Invalid vault password');
      }
    } catch (error) {
      alert('Error unlocking vault');
    }
  };
  
  // Format time for recording
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Auth View
  const AuthView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 px-4">
      <div className="w-full max-w-xl grid md:grid-cols-2 gap-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-purple-600 to-blue-600 text-white p-8">
          <img src="/eterna-logo.png" alt="Eterna" className="w-28 h-28 object-contain mb-3" />
          <h1 className="text-3xl font-bold mb-2">Eterna</h1>
          <p className="text-center opacity-90">AI-powered emotional wellness journal</p>
        </div>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xl font-bold">{authMode === 'login' ? 'Welcome back' : 'Create your account'}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`px-3 py-1 rounded ${authMode === 'login' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`px-3 py-1 rounded ${authMode === 'register' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Register
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4" autoComplete="on">
            {authMode === 'register' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Username</label>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Choose a username"
                  defaultValue={authData.username}
                  ref={usernameRef}
                  className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500"
                  autoComplete="username"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                defaultValue={authData.email}
                ref={emailRef}
                className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                defaultValue={authData.password}
                ref={passwordRef}
                className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>

            <p className="text-center text-xs text-gray-500">By continuing, you agree to our terms.</p>
          </form>
        </div>
      </div>
    </div>
  );
  
  // Home View
  const HomeView = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {user?.username || 'User'}!</h1>
        <p className="text-lg opacity-90">Your Enhanced AI-Powered Emotional Wellness Journal</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView('journal')}>
          <BookOpen className="w-12 h-12 text-blue-500 mb-3" />
          <h3 className="text-xl font-semibold mb-2">Journal</h3>
          <p className="text-gray-600 text-sm">Text & Voice entries</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView('calendar')}>
          <CalendarDays className="w-12 h-12 text-purple-500 mb-3" />
          <h3 className="text-xl font-semibold mb-2">Calendar</h3>
          <p className="text-gray-600 text-sm">View by date</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView('analytics')}>
          <LineChart className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-xl font-semibold mb-2">Analytics</h3>
          <p className="text-gray-600 text-sm">Emotional trends</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView('vault')}>
          <Shield className="w-12 h-12 text-orange-500 mb-3" />
          <h3 className="text-xl font-semibold mb-2">Vault</h3>
          <p className="text-gray-600 text-sm">Secure storage</p>
        </div>
      </div>
      
      {analytics && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">{analytics.totalEntries}</div>
              <div className="text-gray-600">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{analytics.avgJoy}%</div>
              <div className="text-gray-600">Avg Joy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-500">{analytics.avgAnxiety}%</div>
              <div className="text-gray-600">Avg Anxiety</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500">{analytics.avgSadness}%</div>
              <div className="text-gray-600">Avg Sadness</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Recent Entries</h2>
          <button
            onClick={exportEntries}
            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            <FileDown className="w-4 h-4" />
            Export All
          </button>
        </div>
        {filteredEntries.slice(0, 3).map(entry => (
          <div key={entry.id} className="border-l-4 border-blue-500 pl-4 py-3 mb-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              {entry.entry_type === 'voice' && <Mic className="w-4 h-4" />}
              {new Date(entry.created_at).toLocaleString()}
            </div>
            <div className="text-gray-800 line-clamp-2">{entry.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // Journal View with Voice
  const JournalView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          Write Your Reflection
        </h2>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCurrentView('journal-text')}
            className={`flex-1 py-2 px-4 rounded ${currentView === 'journal' || currentView === 'journal-text' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Text Entry
          </button>
          <button
            onClick={() => setCurrentView('journal-voice')}
            className={`flex-1 py-2 px-4 rounded ${currentView === 'journal-voice' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
          >
            Voice Entry
          </button>
        </div>
        
        {currentView !== 'journal-voice' && (
          <>
            <textarea
              defaultValue={currentEntry}
              ref={entryRef}
              placeholder="How are you feeling today? Write your thoughts here..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={saveEntry}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Saving...' : 'Save Entry'}
              </button>
              <button
                onClick={() => setCurrentEntry('')}
                className="flex items-center gap-2 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </div>
      
      {currentView === 'journal-voice' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Voice Recording</h3>
          
          <div className="flex flex-col items-center space-y-4">
            <div className="text-6xl mb-4">
              {isRecording ? '🎙️' : '🎤'}
            </div>
            
            {isRecording && (
              <div className="text-2xl font-bold text-red-500">
                {formatTime(recordingTime)}
              </div>
            )}
            
            <div className="flex gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
                >
                  <MicOff className="w-5 h-5" />
                  Stop Recording
                </button>
              )}
            </div>
            
            {audioURL && (
              <div className="w-full space-y-4">
                <audio controls src={audioURL} className="w-full" />
                
                <textarea
                  value={currentEntry}
                  onChange={(e) => setCurrentEntry(e.target.value)}
                  placeholder="Optional: Add text notes about your voice entry..."
                  className="w-full h-24 p-4 border rounded"
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={saveVoiceEntry}
                    disabled={loading}
                    className="flex items-center gap-2 bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {loading ? 'Saving...' : 'Save Voice Entry'}
                  </button>
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioURL(null);
                      setRecordingTime(0);
                    }}
                    className="bg-gray-300 px-6 py-3 rounded-lg hover:bg-gray-400"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Your Entries ({filteredEntries.length})</h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search entries..."
                defaultValue={searchQuery}
                ref={searchRef}
                onInput={() => {
                  const next = searchRef.current ? searchRef.current.value : '';
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => {
                    const value = next || '';
                    if (value.trim() === '') {
                      setFilteredEntries(entries);
                    } else {
                      const filtered = entries.filter(e => e.content.toLowerCase().includes(value.toLowerCase()));
                      setFilteredEntries(filtered);
                    }
                  }, 120);
                }}
                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={exportEntries}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {entry.entry_type === 'voice' && <Mic className="w-4 h-4 text-purple-500" />}
                  {new Date(entry.created_at).toLocaleString()}
                  <span className="bg-gray-200 px-2 py-1 rounded text-xs">{entry.entry_type}</span>
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {entry.audio_path && (
                <audio controls src={`http://localhost:5000${entry.audio_path}`} className="w-full mb-3" />
              )}
              
              <p className="text-gray-800 mb-3">{entry.content}</p>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="bg-green-100 rounded px-2 py-1 text-center">
                  <div className="font-semibold text-green-700">Joy</div>
                  <div>{entry.sentiment.joy}%</div>
                </div>
                <div className="bg-red-100 rounded px-2 py-1 text-center">
                  <div className="font-semibold text-red-700">Sadness</div>
                  <div>{entry.sentiment.sadness}%</div>
                </div>
                <div className="bg-yellow-100 rounded px-2 py-1 text-center">
                  <div className="font-semibold text-yellow-700">Anxiety</div>
                  <div>{entry.sentiment.anxiety}%</div>
                </div>
                <div className="bg-orange-100 rounded px-2 py-1 text-center">
                  <div className="font-semibold text-orange-700">Anger</div>
                  <div>{entry.sentiment.anger}%</div>
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                💡 {entry.sentiment.feedback}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  // Calendar View
  const CalendarView = () => {
    const getDaysInMonth = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay();
      
      const days = [];
      
      // Add empty cells for days before month starts
      for (let i = 0; i < startDayOfWeek; i++) {
        days.push(null);
      }
      
      // Add days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Prefer server-provided calendar counts, fallback to client-side count from entries
        const serverCount = calendarData.find(d => d.date === dateStr)?.count || 0;
        const clientCount = entries.reduce((acc, e) => {
          try {
            const eDate = (e.created_at || '').slice(0, 10);
            return acc + (eDate === dateStr ? 1 : 0);
          } catch {
            return acc;
          }
        }, 0);
        const entryCount = serverCount || clientCount;
        days.push({ day, date: dateStr, count: entryCount });
      }
      
      return days;
    };
    
    const changeMonth = (direction) => {
      const newMonth = new Date(currentMonth);
      newMonth.setMonth(currentMonth.getMonth() + direction);
      setCurrentMonth(newMonth);
    };
    
    const days = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-6 h-6" />
              Calendar View
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                ← Prev
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                Next →
              </button>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold text-center mb-4">{monthName}</h3>
          
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
            
            {days.map((dayData, index) => (
              <div
                key={index}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg border-2 transition-all cursor-pointer ${
                  dayData
                    ? dayData.count > 0
                      ? 'bg-blue-100 border-blue-300 hover:bg-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                    : 'bg-gray-50 border-transparent'
                }`}
                onClick={() => dayData && setSelectedDate(dayData.date)}
              >
                {dayData && (
                  <>
                    <div className="text-lg font-semibold">{dayData.day}</div>
                    {dayData.count > 0 && (
                      <div className="text-xs bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mt-1">
                        {dayData.count}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
              <span>Has entries</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded"></div>
              <span>No entries</span>
            </div>
          </div>
        </div>
        
        {selectedDate && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold mb-4">
              Entries for {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h3>
            
            <div className="space-y-4">
              {entries.filter(e => e.created_at.startsWith(selectedDate)).map(entry => (
                <div key={entry.id} className="border-l-4 border-purple-500 pl-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    {entry.entry_type === 'voice' && <Mic className="w-4 h-4" />}
                    {new Date(entry.created_at).toLocaleTimeString()}
                  </div>
                  <p className="text-gray-800">{entry.content}</p>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="bg-green-100 px-2 py-1 rounded">Joy: {entry.sentiment.joy}%</span>
                    <span className="bg-red-100 px-2 py-1 rounded">Sadness: {entry.sentiment.sadness}%</span>
                    <span className="bg-yellow-100 px-2 py-1 rounded">Anxiety: {entry.sentiment.anxiety}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Analytics View
  const AnalyticsView = () => {
    if (!analytics) return <div>Loading analytics...</div>;
    
    const computedTrend = (() => {
      const serverTrend = Array.isArray(analytics.trend) ? analytics.trend : [];
      if (serverTrend.length > 0) return serverTrend;
      try {
        const derived = entries.map(e => {
          const date = new Date(e.created_at).toLocaleDateString();
          const raw = (e.sentiment && e.sentiment.overallScore) || '0';
          let score = parseFloat(raw);
          if (isNaN(score) || score === 0) {
            const s = e.sentiment || {};
            const joy = Number(s.joy) || 0;
            const sad = Number(s.sadness) || 0;
            const anx = Number(s.anxiety) || 0;
            const ang = Number(s.anger) || 0;
            score = (joy - (sad + anx + ang)) / 100; // proxy if overallScore missing
          }
          return { date, score };
        }).slice(-14);
        return derived;
      } catch {
        return [];
      }
    })();

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <LineChart className="w-6 h-6" />
            Emotional Analytics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-lg p-6 text-white">
              <div className="text-lg mb-2">Average Joy</div>
              <div className="text-4xl font-bold">{analytics.avgJoy}%</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg p-6 text-white">
              <div className="text-lg mb-2">Average Anxiety</div>
              <div className="text-4xl font-bold">{analytics.avgAnxiety}%</div>
            </div>
            <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-lg p-6 text-white">
              <div className="text-lg mb-2">Average Sadness</div>
              <div className="text-4xl font-bold">{analytics.avgSadness}%</div>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg p-6 text-white">
              <div className="text-lg mb-2">Average Anger</div>
              <div className="text-4xl font-bold">{analytics.avgAnger}%</div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Emotional Trend (Last {computedTrend.length} Entries)</h3>
            {computedTrend.length === 0 ? (
              <div className="text-sm text-gray-500">No trend data yet. Add a few entries to see your chart.</div>
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  const width = Math.max(320, computedTrend.length * 48);
                  const height = 260;
                  const paddingBottom = 24;
                  const barWidth = 24;
                  const gap = 24;
                  const maxAbs = Math.max(0.1, ...computedTrend.map(p => Math.abs(parseFloat(p.score || 0))));
                  return (
                    <svg width={width} height={height} role="img" aria-label="Emotional trend bars">
                      <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
                      {computedTrend.map((p, i) => {
                        const raw = typeof p.score === 'number' ? p.score : parseFloat(p.score || 0);
                        const score = isNaN(raw) ? 0 : raw;
                        const scaled = Math.max(10, (Math.abs(score) / maxAbs) * (height - paddingBottom - 20));
                        const x = i * (barWidth + gap) + 20;
                        const y = height - paddingBottom - scaled;
                        const color = score >= 0 ? '#22c55e' : '#ef4444';
                        return (
                          <g key={i}>
                            <rect x={x} y={y} width={barWidth} height={scaled} fill={color} rx="4" />
                            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
                              {p.date}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">AI Insights</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              {analytics.insights.map((insight, i) => (
                <li key={i}>✓ {insight}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };
  
  // Vault View
  const VaultView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Encrypted Vault
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-2 border-purple-300 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Setup Vault Password</h3>
            <input
              type="password"
              placeholder="New vault password"
              defaultValue={vaultSetup.password}
              ref={vaultSetupPasswordRef}
              className="w-full p-3 border rounded mb-3"
            />
            <input
              type="password"
              placeholder="Confirm password"
              defaultValue={vaultSetup.confirmPassword}
              ref={vaultSetupConfirmRef}
              className="w-full p-3 border rounded mb-3"
            />
            <button
              onClick={setupVault}
              className="w-full bg-purple-500 text-white py-3 rounded hover:bg-purple-600"
            >
              Configure Vault
            </button>
          </div>
          
          <div className="border-2 border-blue-300 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Unlock Vault</h3>
            {!isVaultUnlocked ? (
              <>
                <input
                  type="password"
                  placeholder="Enter vault password"
                  defaultValue={vaultPassword}
                  ref={vaultPasswordRef}
                  className="w-full p-3 border rounded mb-3"
                />
                <button
                  onClick={unlockVault}
                  className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600"
                >
                  Unlock Vault
                </button>
              </>
            ) : (
              <div>
                <div className="bg-green-100 border border-green-400 rounded p-3 mb-3 text-green-800">
                  🔓 Vault Unlocked Successfully
                </div>
                <button
                  onClick={() => setIsVaultUnlocked(false)}
                  className="w-full bg-gray-300 py-3 rounded hover:bg-gray-400"
                >
                  Lock Vault
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Vault Features</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ AES-256 Encryption (Simulated)</li>
            <li>✓ Blockchain Immutable Storage</li>
            <li>✓ IPFS Distributed Storage</li>
            <li>✓ Legacy Unlock Configuration</li>
            <li>✓ Secured Entries: {entries.length}</li>
            <li>✓ Voice Entries Protected</li>
          </ul>
        </div>
      </div>
    </div>
  );
  
  // Not authenticated
  if (!token) {
    return <AuthView />;
  }
  
  // Authenticated
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <nav className="bg-white shadow-md mb-6">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/eterna-logo.png" alt="Eterna" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Eterna</span>
            </div>
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setCurrentView('home')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'home' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <Home className="w-5 h-5" />
                Home
              </button>
              <button
                onClick={() => setCurrentView('journal')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView.startsWith('journal') ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                Journal
              </button>
              <button
                onClick={() => setCurrentView('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'calendar' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <CalendarDays className="w-5 h-5" />
                Calendar
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'analytics' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <LineChart className="w-5 h-5" />
                Analytics
              </button>
              <button
                onClick={() => setCurrentView('vault')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'vault' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                }`}
              >
                <Shield className="w-5 h-5" />
                Vault
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-red-100 text-red-600"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {currentView === 'home' && <HomeView />}
        {currentView.startsWith('journal') && <JournalView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'analytics' && <AnalyticsView />}
        {currentView === 'vault' && <VaultView />}
      </div>
      
      {/* Footer removed as requested */}
    </div>
  );
};

export default App;