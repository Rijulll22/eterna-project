// server.js - Main Backend Server for Eterna
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'eterna_secret_key_demo_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads-audio', express.static(path.join(__dirname, 'uploads-audio')));

// Initialize SQLite Database
const db = new sqlite3.Database('./database/eterna.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeDatabase();
  }
});
function parseSentimentSafe(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      joy: Number(parsed.joy) || 0,
      sadness: Number(parsed.sadness) || 0,
      anxiety: Number(parsed.anxiety) || 0,
      anger: Number(parsed.anger) || 0,
      neutral: Number(parsed.neutral) || 0,
      overallScore: parsed.overallScore !== undefined ? String(parsed.overallScore) : '0',
      feedback: parsed.feedback || 'No feedback available.',
      timestamp: parsed.timestamp || new Date().toISOString()
    };
  } catch (e) {
    return {
      joy: 0, sadness: 0, anxiety: 0, anger: 0, neutral: 100,
      overallScore: '0', feedback: 'No feedback available.', timestamp: new Date().toISOString()
    };
  }
}


// Create Tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Entries table
    db.run(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      sentiment_data TEXT,
      encrypted BOOLEAN DEFAULT 0,
      ipfs_cid TEXT,
      blockchain_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Attempt to add new columns if they do not exist (ignore errors if already added)
    db.run(`ALTER TABLE entries ADD COLUMN entry_type TEXT DEFAULT 'text'`, (err) => {});
    db.run(`ALTER TABLE entries ADD COLUMN audio_path TEXT`, (err) => {});

    // Vault settings table
    db.run(`CREATE TABLE IF NOT EXISTS vault_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      vault_password TEXT NOT NULL,
      legacy_contacts TEXT,
      unlock_rules TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    console.log('✅ Database tables initialized');
  });
}

// ==================== ENHANCED AI SENTIMENT ANALYSIS SERVICE ====================
function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  const emotionPatterns = {
    joy: {
      direct: [
        'happy','joy','excited','glad','great','wonderful','love','awesome','amazing','good','better','best','fantastic','excellent','pleased','delighted','cheerful','grateful','blessed','optimistic','hopeful','confident','proud','thrilled','ecstatic','relieved','content','satisfied','fulfilled','alive','motivated','inspired','uplifted','vibrant','enthusiastic','energized','winning','smiling','laughing','peaceful','calm','relaxing','clear mind','accomplished','improving','making progress','grinning','fun','playful'
      ],
      indirect: [
        'smile','smiling','laugh','bright','light','sunshine','breeze','luck','eased','lucid','at ease','ok','alright','in a good place','at peace','harmonious','positive','moving forward','things are looking up','on track','humming','soothing','cheered','grin','grateful for','content with','simple joys','supportive','uplifting'
      ],
      phrases: [
        'feel good','going well','turned out great','can\'t wait','looking forward','things are working out','everything is falling into place','life is awesome','walking on air','on top of the world','all is well','finding my path','where i belong','going with the flow','making progress','things are in my favor','moment of peace','simple pleasures','good friends','finally finished','rest easy','smile on my face'
      ]
    },
    sadness: {
      direct: [
        'sad','depressed','miserable','disappointed','upset','hurt','pain','lonely','hopeless','worthless','down','blue','cry','crying','tears','melancholy','let down','discouraged','defeated','lost','empty','exhausted','drained','numb','heavy','tired','fragile','abandoned','isolated','unloved','heartbroken','rejected','forgotten','left out','excluded','ashamed','shameful','guilty','embarrassed','embarrassing','pathetic','hopeless','regret','remorse','sorry','ruined','devastated','missing out','overshadowed','weak','inferior','inadequate','failure','ruined day','wasted','i deserve','unsuccessful','not enough','let myself down'
      ],
      indirect: [
        'empty','hollow','numb','heavy','low','dark','alone','isolated','disconnected','loss','lost','miss','missing','grief','like a shadow','rainy','overcast','fog','stuck','nowhere to go','listless','weighed down','emotionless','no energy','lack of direction','overwhelmed','swamped','buried','scatterbrained','worn out','cloudy','no way out','irrelevant','ignored','left behind','not noticed','nobody cares','burned out','burnt out','burnout','pessimist','ruined','crushed','let down','rejected','can\'t trust','looked down','judged','don\'t fit in','not accepted','unappreciated'
      ],
      phrases: [
        'feel low','feeling down','not good','dont care','no point','give up','cant do','things are falling apart','nothing is going right','nothing works','im not ok','im not fine','im drowning','everything is grey','i\'m left behind','i\'m stuck','i\'m lost','i dont belong','i feel empty','i\'m going nowhere','something is missing','don\'t know what to do anymore','nobody cares','no one listens','no support','wasted effort','didn\'t work out','nothing works out','regret that choice','so pointless','never enough','i shouldn\'t have','i wish i could','nobody helps','my fault','all alone','feel invisible','nobody noticed','wasn\'t picked','wasn\'t chosen','apologies all the time','sorry for everything','waking up tired'
      ]
    },
    anxiety: {
      direct: [
        'worried','anxious','nervous','stressed','uneasy','fear','scared','concern','panic','overwhelmed','tense','restless','uncertain','afraid','dread','paranoid','pressure','apprehensive','edgy','alert','not sure','can\'t remember','grilled','questioned','out of many','really hard','mental block','blank','doubt','second guessing','hesitant','uneasy','uncertain','difficulty sleeping','insomnia','worrying','panic attack','on edge','unprepared','dizzy','shaky'
      ],
      indirect: [
        'sweaty','sweating','shaking','trembling','racing','pounding','tight','cant breathe','breathe','dizzy','nauseous','sick','stomach','chest','unsure','what if','bad feeling','unsettled','overthinking','on edge','up in the air','out of my depth','heart skips','fidgety','worst case','unpredictable','unknown ahead','under pressure','nervous energy','touch and go','tick tock','unsettling','timid','cannot relax','self-conscious','jitters','nail-biting','doubtful','inner turmoil','tension'
      ],
      phrases: [
        'cant stop thinking','keep worrying','on edge','out of control','too much','cant handle','my mind is racing','nothing is certain','things could go wrong','cant seem to relax','my heart is pounding','i feel unsafe','worried sick','my mind wont rest','i\'m spiraling','waiting for the other shoe to drop','everything is uncertain','didn\'t prepare','didn\'t study enough','not ready for test','running late','behind schedule','deadline is close','afraid to ask','i might fail'
      ]
    },
    anger: {
      direct: [
        'angry','furious','mad','rage','irritated','annoyed','frustrated','hostile','hate','resentful','outraged','enraged','pissed','fuming','boiling','snapped','exploded','tense','aggravated','offended','bitter','wrathful','grilled','questioned','interrogated','cops','police','authority','scolded','lectured','called out','accused','forced','pushed','dismissed','ignored','misunderstood','unfair','demanded','told off','snapped at','bossed','targeted','unjust','forced to','told to','asked if','being told','out of many','study properly','so they said','sarcastic','mocked','ridiculed','sassed','shamed','humiliated','shut down','argued','fight','bicker','glared','backtalk','defiant','rebel','fed up with','nagged','lost temper'
      ],
      indirect: [
        'explode','snap','bitter','resentful','unfair','injustice','betrayed','disrespected','ignored','walked all over','pushed too far','over the edge','at my limit','done with it','can\'t stand','my blood boils','on my nerves','seeing red','had enough','fed up','infuriated','bossy','criticized','scolded','targeted','humiliated','overstepped','burdened','ganged up','put on the spot','blamed','judged','scapegoat','insulted','pushed aside','wasn\'t heard','wasn\'t given a chance','forced to do','obligated','feeling controlled','resent','unrecognized','unappreciated','held back','cut off in traffic','rolled my eyes','irony','self deprecating','sighing','talked down to','bothered','misjudged','demanding','bossing','enforced','argument'
      ],
      phrases: [
        'fed up','had enough','cant take','make me so','drives me','at my wits end','pushed to the edge','my patience is gone','one more thing and...','i\'m about to lose it','beyond frustrated','i want to scream','flipped out','just blew up','why does this always happen','i\'m so done','told to do','so they said','made me feel stupid','treated unfairly','no matter what i do','not my fault','out of many','so unfair','no reason','didn\'t listen to me','i was told','forced to comply','couldn\'t give an answer','talked down to me','who do they think they are','what a joke','this is ridiculous','unbelievable','i can\'t take this anymore','not putting up with','roll with my eyes','get lost','get over it','not my problem','leave me alone','stop bothering me','sarcastic remark','biting comment','unamused','whatever','typical','always the same','keep nagging','tired of this'
      ]
    }
  };

  // Unchanged: physicalSymptoms mapping ...
  const physicalSymptoms = {
    anxiety: ['sweaty','sweating','shaking','trembling','racing heart','pounding','tight chest','cant breathe','dizzy','nauseous','stomach','butterflies'],
    sadness: ['tired','exhausted','heavy','drained','no energy','cant move','numb'],
    anger: ['hot','burning','tense','clenched','tight jaw']
  };

  let scores = { joy: 0, sadness: 0, anxiety: 0, anger: 0 };
  Object.keys(emotionPatterns).forEach(emotion => {
    const pattern = emotionPatterns[emotion];
    pattern.direct.forEach(word => {
      if (words.includes(word) || lowerText.includes(word)) scores[emotion] += 3;
    });
    pattern.indirect.forEach(word => {
      if (lowerText.includes(word) || words.some(w => w.startsWith(word) || word.startsWith(w))) scores[emotion] += 2;
    });
    pattern.phrases.forEach(phrase => {
      if (lowerText.includes(phrase)) scores[emotion] += 4;
    });
  });
  // Additional conversational/authority cues
  if (/(cops|police|authority|scolded|lectured|being told|questioned|interrogated|grilled|asked if|out of many|study properly|so they said|dismissed|not listened|ignored|accused|forced to|pushed|told off|bossed|targeted|called out|demanded|blamed|no reason|scapegoat|sarcastic|irony|mocked|ridiculed|shamed|insulted)/.test(lowerText)) {
    scores.anger += 6;
  }
  // If memory/overwhelm cues found, give both anxiety and sadness
  if (/(hard to remember|can\'t remember|hard to recall|overwhelmed|confused|many things|blank|with so much|so much to remember|can\'t think|wasn\'t sure|mental block|cloudy|too much to handle|memory fails|forgot|out of many|overwhelmed|anxiety|pressure|panic|scatterbrained|running late|afraid to)/.test(lowerText)) {
    scores.anxiety += 3;
    scores.sadness += 3;
  }
  // If scolded, targeted, or dismissed, bump both anger and sadness
  if (/(scolded|told to|called out|humiliated|targeted|dismissed|not listened|criticized|made to feel|lectured|treated unfairly|misunderstood|picked on|bothered|nagged|yelled at|sarcastic remark|rolled my eyes|shut down|made fun of)/.test(lowerText)) {
    scores.anger += 3;
    scores.sadness += 2;
  }

  // Physical symptoms
  Object.keys(physicalSymptoms).forEach(emotion => {
    physicalSymptoms[emotion].forEach(symptom => {
      if (lowerText.includes(symptom)) scores[emotion] += 2.5;
    });
  });

  // Negation handling
  const negations = ['not','no','never','dont',"don't",'cant',"can't",'wont',"won't",'nothing'];
  let hasNegation = negations.some(neg => lowerText.includes(neg));
  if (hasNegation && scores.joy > 0) {
    scores.joy = Math.max(0, scores.joy - 3);
    scores.sadness += 2;
  }
  // Intensifiers
  const intensifiers = ['very','really','so','extremely','incredibly','absolutely','totally','utterly','deeply'];
  let intensifierCount = intensifiers.filter(int => lowerText.includes(int)).length;
  if (intensifierCount > 0) {
    Object.keys(scores).forEach(emotion => {
      scores[emotion] *= (1 + intensifierCount * 0.2);
    });
  }

  // Calculate percentages
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const percentages = {
    joy: Math.min(Math.round((scores.joy / totalScore) * 100), 100),
    sadness: Math.min(Math.round((scores.sadness / totalScore) * 100), 100),
    anxiety: Math.min(Math.round((scores.anxiety / totalScore) * 100), 100),
    anger: Math.min(Math.round((scores.anger / totalScore) * 100), 100)
  };
  const emotionSum = percentages.joy + percentages.sadness + percentages.anxiety + percentages.anger;
  const neutral = emotionSum < 100 ? 100 - emotionSum : 0;
  const overallScore = ((scores.joy - scores.sadness - scores.anger) / totalScore).toFixed(2);
  // If everything is still 0 and it's nontrivial input, assign minimal likely percentages
  if (percentages.joy + percentages.sadness + percentages.anxiety + percentages.anger === 0 && words.length > 10) {
    if (/(cops|police|authority|scolded|lectured|questioned|grilled|asked if|out of many|study properly|so they said|dismissed|not listened|ignored|accused|forced to|pushed|told off|bossed|targeted|called out|demanded|blamed|sarcastic|mocked|ridiculed|shamed|insulted)/.test(lowerText)) {
      percentages.anger = 10;
    }
    if (/(hard to remember|can\'t remember|overwhelmed|confused|blank|cannot focus|lost|memory|scatterbrained|panic|worry)/.test(lowerText)) {
      percentages.anxiety = 8;
      percentages.sadness = 8;
    }
    // fallback to mild anger if nothing matches
    if (percentages.anger === 0 && percentages.anxiety === 0 && percentages.sadness === 0) {
      percentages.anger = 7;
    }
  }

  const dominant = Object.keys(percentages).reduce((a, b) => percentages[a] > percentages[b] ? a : b);
  const feedbackMap = {
    joy: "Your reflection radiates positive energy! Keep embracing these uplifting moments.",
    sadness: "I hear the heaviness in your words. It's completely valid to feel this way. You're not alone.",
    anxiety: "I sense worry and tension. Try taking deep breaths and focus on what you can control right now.",
    anger: "I sense frustration and anger. These feelings are valid signals that something matters to you."
  };
  let feedback = feedbackMap[dominant] || "Your reflection shows a mix of emotions. Continue this practice of self-awareness.";
  if (percentages.anxiety > 30 && percentages.sadness > 30) {
    feedback = "I notice a mix of worry and sadness. Consider reaching out to someone you trust or practicing self-compassion.";
  }
  return {
    joy: percentages.joy,
    sadness: percentages.sadness,
    anxiety: percentages.anxiety,
    anger: percentages.anger,
    neutral: Math.round(neutral),
    overallScore,
    feedback,
    timestamp: new Date().toISOString()
  };
}

// Detect contradictions between entries
function detectContradictions(newEntry, previousEntries) {
  const contradictions = [];
  const newSentiment = analyzeSentiment(newEntry.content);
  previousEntries.slice(-5).forEach(oldEntry => {
    const oldSentiment = parseSentimentSafe(oldEntry.sentiment_data);
    if (Math.abs(parseFloat(newSentiment.overallScore) - parseFloat(oldSentiment.overallScore || 0)) > 1.5) {
      contradictions.push({
        type: 'emotional',
        oldEntryId: oldEntry.id,
        message: 'Significant mood shift detected from previous entry',
        oldDate: oldEntry.created_at
      });
    }
  });
  return contradictions;
}

// ==================== AUTHENTICATION MIDDLEWARE ====================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim();
  const password = (req.body.password || '').toString();
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email.toLowerCase(), hashedPassword],
      function(err) {
        if (err) return res.status(400).json({ error: 'Username or email already exists' });
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ message: 'User registered successfully', token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '').toString();
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  db.get('SELECT * FROM users WHERE lower(email) = ?', [email], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email } });
  });
});

// ==================== ENTRY ROUTES ====================
app.post('/api/entries', authenticateToken, (req, res) => {
  const { content } = req.body;
  const userId = req.user.id;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const sentiment = analyzeSentiment(content);
  const ipfsCid = `Qm${Math.random().toString(36).substring(2, 15)}`;
  const blockchainHash = `0x${Math.random().toString(36).substring(2, 15)}`;
  db.run(
    'INSERT INTO entries (user_id, content, sentiment_data, ipfs_cid, blockchain_hash, entry_type) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, content, JSON.stringify(sentiment), ipfsCid, blockchainHash, 'text'],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create entry' });
      db.all('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId], (err, entries) => {
        const contradictions = err ? [] : detectContradictions({ content }, entries);
        res.status(201).json({
          message: 'Entry created successfully',
          entry: { id: this.lastID, content, sentiment, ipfsCid, blockchainHash, contradictions, created_at: new Date().toISOString(), entry_type: 'text' }
        });
      });
    }
  );
});

app.get('/api/entries', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, entries) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch entries' });
    const processedEntries = entries.map(entry => ({
      ...entry,
      created_at: entry.created_at ? new Date(entry.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
      sentiment: parseSentimentSafe(entry.sentiment_data),
      entry_type: entry.entry_type || 'text',
      audio_path: entry.audio_path || null
    }));
    res.json({ entries: processedEntries });
  });
});

app.get('/api/entries/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  db.get('SELECT * FROM entries WHERE id = ? AND user_id = ?', [id, userId], (err, entry) => {
    if (err || !entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ entry: { ...entry, created_at: entry.created_at ? new Date(entry.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(), sentiment: parseSentimentSafe(entry.sentiment_data), entry_type: entry.entry_type || 'text', audio_path: entry.audio_path || null } });
  });
});

app.delete('/api/entries/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  db.run('DELETE FROM entries WHERE id = ? AND user_id = ?', [id, userId], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Entry not found or cannot be deleted' });
    res.json({ message: 'Entry deleted (Note: In production, entries are immutable)', warning: 'Blockchain entries cannot be deleted in production version' });
  });
});

// ==================== ANALYTICS ROUTES ====================
app.get('/api/analytics', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT sentiment_data, created_at FROM entries WHERE user_id = ? ORDER BY created_at ASC', [userId], (err, entries) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch analytics' });
    if (entries.length === 0) return res.json({ totalEntries: 0, avgJoy: 0, avgSadness: 0, avgAnxiety: 0, avgAnger: 0, trend: [] });
    let totalJoy = 0, totalSadness = 0, totalAnxiety = 0, totalAnger = 0;
    entries.forEach(entry => {
      const sentiment = parseSentimentSafe(entry.sentiment_data);
      totalJoy += sentiment.joy; totalSadness += sentiment.sadness; totalAnxiety += sentiment.anxiety; totalAnger += sentiment.anger || 0;
    });
    const count = entries.length;
    const trend = entries.slice(-14).map(entry => {
      const sentiment = parseSentimentSafe(entry.sentiment_data);
      return { date: new Date((entry.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString(), score: parseFloat(sentiment.overallScore), joy: sentiment.joy, sadness: sentiment.sadness, anxiety: sentiment.anxiety };
    });
    res.json({ totalEntries: count, avgJoy: Math.round(totalJoy / count), avgSadness: Math.round(totalSadness / count), avgAnxiety: Math.round(totalAnxiety / count), avgAnger: Math.round(totalAnger / count), trend, insights: generateInsights(totalJoy / count, totalSadness / count, totalAnxiety / count, count) });
  });
});

function generateInsights(avgJoy, avgSadness, avgAnxiety, totalEntries) {
  const insights = [];
  insights.push(`You've been journaling for ${totalEntries} days. Great consistency!`);
  if (avgJoy > 50) insights.push('Your overall mood trend is positive! Keep it up!'); else insights.push('Consider activities that bring you joy and peace.');
  if (avgAnxiety > 50) insights.push('Try mindfulness exercises or meditation to manage anxiety.'); else insights.push('Your anxiety levels are well-managed. Good work!');
  if (avgSadness > 50) insights.push('Consider reaching out to friends, family, or a professional for support.');
  return insights;
}

// ==================== VAULT ROUTES ====================
app.post('/api/vault/setup', authenticateToken, async (req, res) => {
  const { vaultPassword, legacyContacts, unlockRules } = req.body;
  const userId = req.user.id;
  if (!vaultPassword) return res.status(400).json({ error: 'Vault password required' });
  try {
    const hashedVaultPassword = await bcrypt.hash(vaultPassword, 10);
    db.run('INSERT OR REPLACE INTO vault_settings (user_id, vault_password, legacy_contacts, unlock_rules) VALUES (?, ?, ?, ?)', [userId, hashedVaultPassword, JSON.stringify(legacyContacts || []), JSON.stringify(unlockRules || {})], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to setup vault' });
      res.json({ message: 'Vault configured successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Vault setup failed' });
  }
});

app.post('/api/vault/unlock', authenticateToken, (req, res) => {
  const { vaultPassword } = req.body;
  const userId = req.user.id;
  db.get('SELECT * FROM vault_settings WHERE user_id = ?', [userId], async (err, vault) => {
    if (err || !vault) return res.status(404).json({ error: 'Vault not configured' });
    const validPassword = await bcrypt.compare(vaultPassword, vault.vault_password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid vault password' });
    res.json({ message: 'Vault unlocked successfully', legacyContacts: JSON.parse(vault.legacy_contacts), unlockRules: JSON.parse(vault.unlock_rules) });
  });
});

// ==================== VOICE ENTRY ROUTE ====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads-audio');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '.webm');
    cb(null, `voice-${unique}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/entries/voice', authenticateToken, upload.single('audio'), (req, res) => {
  const userId = req.user.id;
  const transcription = req.body.transcription || '[Voice entry]';
  const content = transcription;
  const sentiment = analyzeSentiment(content);
  const ipfsCid = `Qm${Math.random().toString(36).substring(2, 15)}`;
  const blockchainHash = `0x${Math.random().toString(36).substring(2, 15)}`;
  const audioRelativePath = req.file ? `/uploads-audio/${req.file.filename}` : null;
  db.run('INSERT INTO entries (user_id, content, sentiment_data, ipfs_cid, blockchain_hash, entry_type, audio_path) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, content, JSON.stringify(sentiment), ipfsCid, blockchainHash, 'voice', audioRelativePath], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save voice entry' });
    res.status(201).json({ message: 'Voice entry saved', entry: { id: this.lastID, content, sentiment, ipfsCid, blockchainHash, entry_type: 'voice', audio_path: audioRelativePath, created_at: new Date().toISOString() } });
  });
});

// ==================== EXPORT ROUTE ====================
app.get('/api/entries/export', authenticateToken, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at ASC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to export entries' });
    const entries = rows.map(r => ({ id: r.id, created_at: r.created_at ? new Date(r.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(), entry_type: r.entry_type || 'text', content: r.content, sentiment: parseSentimentSafe(r.sentiment_data || '{}') }));
    res.json({ exportDate: new Date().toISOString(), totalEntries: entries.length, entries });
  });
});

// ==================== CALENDAR ROUTE ====================
app.get('/api/entries/calendar', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const year = req.query.year;
  const month = req.query.month && String(req.query.month).padStart(2, '0');
  if (!year || !month) return res.status(400).json({ error: 'year and month are required' });
  const sql = `
    SELECT substr(created_at, 1, 10) as date, COUNT(*) as count
    FROM entries
    WHERE user_id = ? AND strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
    GROUP BY substr(created_at, 1, 10)
    ORDER BY date ASC
  `;
  db.all(sql, [userId, String(year), String(month)], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch calendar' });
    const calendar = rows.map(r => ({ date: r.date, count: r.count }));
    res.json({ calendar });
  });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Eterna API is running', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`\n🚀 Eterna Backend Server Running!`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`\n✨ Ready to accept requests!\n`);
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Error closing database:', err);
    else console.log('\n✅ Database connection closed');
    process.exit(0);
  });
});