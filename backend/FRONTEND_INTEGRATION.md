# Frontend Integration Guide

This guide explains how to integrate your React frontend with the FastAPI backend.

## 1. Environment Setup

Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Fill in your credentials:
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret
- `XAI_API_KEY`: X AI API Key

## 2. Frontend Authentication Flow

### Google Login Integration

Update your `frontend/src/pages/LoginPage.js`:

```jsx
import React, { useState } from 'react';
import styled from 'styled-components';

const LoginPageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  padding: 20px;
`;

const LoginCard = styled.div`
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const GoogleLoginButton = styled.button`
  width: 100%;
  padding: 14px;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-bottom: 20px;

  &:hover {
    background-color: #3367D6;
  }
`;

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Get Google OAuth URL
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/auth-url`);
      const data = await response.json();

      // Redirect to Google login
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to initiate Google login');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCallback = async () => {
    // Extract id_token from URL fragment
    const urlParams = new URLSearchParams(window.location.hash.substr(1));
    const id_token = urlParams.get('id_token');

    if (id_token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id_token }),
        });

        const data = await response.json();

        if (response.ok) {
          // Store token and user info
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('user', JSON.stringify(data.user));

          // Redirect to dashboard
          window.location.href = '/dashboard';
        } else {
          setError('Login failed');
        }
      } catch (err) {
        setError('Login error');
        console.error(err);
      }
    }
  };

  // Handle OAuth callback on component mount
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('id_token')) {
      handleGoogleCallback();
    }
  }, []);

  return (
    <LoginPageContainer>
      <LoginCard>
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>登录系统</h2>

        {error && (
          <div style={{
            color: 'red',
            textAlign: 'center',
            marginBottom: '16px',
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: '#ffebee'
          }}>
            {error}
          </div>
        )}

        <GoogleLoginButton onClick={handleGoogleLogin} disabled={isLoading}>
          {isLoading ? '登录中...' : '使用 Google 登录'}
        </GoogleLoginButton>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
          使用您的 Google 账户快速登录
        </p>
      </LoginCard>
    </LoginPageContainer>
  );
}

export default LoginPage;
```

### API Configuration

Create `frontend/src/api.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = {
  // Auth
  getAuthUrl: () => fetch(`${API_BASE_URL}/api/v1/auth/google/auth-url`),
  loginWithGoogle: (idToken) =>
    fetch(`${API_BASE_URL}/api/v1/auth/google/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken })
    }),

  // X Agent API
  analyzeKeyword: (keyword, analysisType) =>
    fetch(`${API_BASE_URL}/api/v1/x-agent/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        keyword,
        analysis_type: analysisType || 'both'
      })
    }),

  getAnalysisHistory: () =>
    fetch(`${API_BASE_URL}/api/v1/x-agent/history`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }),

  getTrendingTopics: (keyword) =>
    fetch(`${API_BASE_URL}/api/v1/x-agent/trending?keyword=${keyword}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
};

export default api;
```

## 3. X Agent Page Integration

Update `frontend/src/pages/TwitterPage.js`:

```jsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import api from '../api';

const TwitterPageContainer = styled.div`
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
`;

const SearchSection = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  min-width: 300px;
`;

const SearchButton = styled.button`
  padding: 12px 24px;
  background-color: #1da1f2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background-color: #1991db;
  }
`;

const ResultSection = styled.div`
  margin-top: 32px;
`;

const Loading = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
`;

function TwitterPage() {
  const [keyword, setKeyword] = useState('');
  const [analysisType, setAnalysisType] = useState('both');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await api.analyzeKeyword(keyword, analysisType);
      const data = await response.json();

      if (response.ok) {
        setResults(data);
      } else {
        setError('分析失败');
      }
    } catch (err) {
      setError('网络错误');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <TwitterPageContainer>
      <h1>X 平台关键词分析</h1>

      <SearchSection>
        <SearchInput
          type="text"
          placeholder="输入要分析的关键词..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value)}
          style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
        >
          <option value="trending">热点分析</option>
          <option value="sentiment">舆情分析</option>
          <option value="both">综合分析</option>
        </select>

        <SearchButton onClick={handleSearch} disabled={loading}>
          {loading ? '分析中...' : '开始分析'}
        </SearchButton>
      </SearchSection>

      {error && (
        <div style={{ color: 'red', padding: '16px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {loading && <Loading>正在分析中，请稍候...</Loading>}

      {results && (
        <ResultSection>
          <h2>分析结果: {results.keyword}</h2>

          {results.data?.data?.trending_topics && (
            <div style={{ marginBottom: '32px' }}>
              <h3>热点话题</h3>
              <ul>
                {results.data.data.trending_topics.map((topic, index) => (
                  <li key={index}>{topic}</li>
                ))}
              </ul>
            </div>
          )}

          {results.data?.data?.sentiment_analysis && (
            <div style={{ marginBottom: '32px' }}>
              <h3>舆情分析</h3>
              <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
                {JSON.stringify(results.data.data.sentiment_analysis, null, 2)}
              </pre>
            </div>
          )}

          {results.data?.data?.insights && (
            <div>
              <h3>洞察建议</h3>
              <ul>
                {results.data.data.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </ResultSection>
      )}
    </TwitterPageContainer>
  );
}

export default TwitterPage;
```

## 4. Run the Application

### Start Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python run.py
```

### Start Frontend
```bash
cd frontend
npm start
```

## 5. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:8000/api/v1/auth/google/callback` (development)
   - `https://yourdomain.com/api/v1/auth/google/callback` (production)

## 6. API Documentation

Once the server is running, you can view the API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 7. Authentication Middleware

The backend includes an authentication middleware. For development, it's disabled. For production:

1. Uncomment the AuthMiddleware in `app/main.py`
2. Ensure all protected routes include authentication
3. Store JWT tokens in secure HTTP-only cookies in production