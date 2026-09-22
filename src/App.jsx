import { useEffect, useState } from 'react';
import { t } from '@lingui/core/macro';
import { APP_LOCALES, activateLocale, i18n } from './i18n/setup';
import { speak, stopSpeech } from './services/speech';
import { useToyRecordings } from './hooks/useToyRecordings';
import { getInstallId, getInstallAction, isIOS } from './services/install';
import { ViewCounter } from './components/ViewCounter';

const logoUrl = 'https://epilepsy.org.hk/wp-content/uploads/elementor/thumbs/EFHK-abb-Logo-Ver-%E5%9C%93%E5%BA%95-rsi4tzw9b949vi84j6y5gkdzbj2s5xn3mit7czgz2g.png';

function ContentPanel({ summary, children, className }) {
  return (
    <details className={className}>
      <summary>{summary}</summary>
      <div className="content">{children}</div>
    </details>
  );
}

export default function App() {
  const [language, setLanguage] = useState('zh-HK');
  const [mode, setMode] = useState('edu');
  const educationStatus = () => t({ id: 'status.educationDefault', message: 'Education Mode: Click buttons for instructions.' });
  const toyStatus = () => t({ id: 'status.toyDefault', message: 'Toy Mode: Ready.' });
  const [status, setStatus] = useState(educationStatus);
  const [recordMode, setRecordMode] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const toyRecordings = useToyRecordings();
  const labels = {
    slogan: t({ id: 'header.slogan', message: 'STAY, SAFE, SIDE, HELP' }),
    subtitle: t({ id: 'header.subtitle', message: 'Acute Seizure Management Slogan' }),
    secondarySubtitle: t({ id: 'header.secondarySubtitle', message: '處理急性腦癇發作的口訣' }),
    clicks: t({ id: 'counter.label', message: 'Global Clicks:' }),
    mode: t({ id: 'mode.label', message: 'App Mode:' }),
    education: t({ id: 'mode.education', message: 'Education Mode' }),
    toy: t({ id: 'mode.toy', message: 'Toy Mode (Record/Play)' }),
    recordOff: t({ id: 'record.off', message: 'Record Mode: OFF' }),
    recordOn: t({ id: 'record.on', message: 'Record Mode: ON (Click a button)' }),
    buttons: [
      t({ id: 'action.stay', message: 'STAY' }),
      t({ id: 'action.safe', message: 'SAFE' }),
      t({ id: 'action.side', message: 'SIDE' }),
      t({ id: 'action.help', message: 'HELP' }),
    ],
    guideTitle: t({ id: 'guide.title', message: 'Seizure First Aid Guide' }),
    setup: t({ id: 'setup.summary', message: '📲 Setup & Guide ▼' }),
    install: t({ id: 'install.button', message: '📥 Install App' }),
    whatIs: t({ id: 'whatIs.summary', message: "💡 What is Be Aware n' Be Around? ▼" }),
    faq: t({ id: 'faq.summary', message: '❓ Frequently Asked Questions (FAQ) ▼' }),
  };

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  function changeLanguage(nextLanguage) {
    activateLocale(nextLanguage);
    setLanguage(nextLanguage);
    setStatus(mode === 'edu' ? educationStatus() : toyStatus());
  }

  function changeMode(event) {
    const nextMode = event.target.value;
    stopSpeech();
    toyRecordings.cleanup();
    setRecordMode(false);
    setMode(nextMode);
    setStatus(nextMode === 'edu' ? educationStatus() : toyStatus());
  }

  function activateAction(id) {
    if (mode !== 'edu') {
      if (recordMode) {
        const outcome = toyRecordings.record(id);
        setStatus(outcome === 'busy' ? t({ id: 'status.recordingBusy', message: 'Please stop the current recording first!' }) : outcome === 'started' ? i18n._({ id: 'status.recording', message: 'Recording on button {id}... (Max 60s)' }, { id }) : toyStatus());
      } else {
        setStatus(toyRecordings.play(id) ? i18n._({ id: 'status.playingRecording', message: 'Playing button {id}...' }, { id }) : t({ id: 'status.noRecording', message: 'No audio recorded yet.' }));
      }
      return;
    }

    const steps = [
      t({ id: 'education.step1', message: 'STAY. Stay calm and time the seizure.' }),
      t({ id: 'education.step2', message: 'SAFE. Observe and keep the person safe. Clear hard objects and cushion their head.' }),
      t({ id: 'education.step3', message: 'SIDE. Gently roll the person onto their side. Never put anything in their mouth.' }),
      t({ id: 'education.step4', message: 'HELP. Seek help. Stay with them until fully conscious, and call an ambulance if it lasts over five minutes.' }),
    ];
    const didSpeak = speak(steps[id - 1], APP_LOCALES[language].speechLocale);
    setStatus(didSpeak ? i18n._({ id: 'status.playingEducation', message: 'Playing education step {id}...' }, { id }) : educationStatus());
  }

  async function toggleRecordMode() {
    if (recordMode) {
      toyRecordings.cleanup();
      setRecordMode(false);
      setStatus(t({ id: 'status.playbackMode', message: 'Playback mode active.' }));
      return;
    }
    if (await toyRecordings.enable()) {
      setRecordMode(true);
      setStatus(t({ id: 'status.readyToRecord', message: 'Ready to record.' }));
    } else {
      setStatus(t({ id: 'status.microphoneRequired', message: 'Microphone permission required.' }));
    }
  }

  async function installApp() {
    if (getInstallAction({ isIOS: isIOS(), prompt: installPrompt }) === 'prompt') {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    window.alert(t({ id: 'install.fallbackAlert', message: "To install, use your browser's Add to Home Screen option." }));
  }

  return (
    <main>
      <div className="top-bar">
        <div className="top-left-group">
          <a href="https://epilepsy.org.hk" target="_blank" rel="noopener noreferrer" className="logo-link">
            <img src={logoUrl} alt={t({ id: 'organization.logoAlt', message: 'Epilepsy Foundation of Hong Kong' })} className="app-logo" />
          </a>
          <div className="org-name">
            <div className="org-name-zh">{t({ id: 'organization.nameChinese', message: '香港腦癇基金會' })}</div>
            <div className="org-name-en">{t({ id: 'organization.name', message: 'Epilepsy Foundation of Hong Kong' })}</div>
          </div>
        </div>
        <div className="lang-selector" aria-label={t({ id: 'language.selectorLabel', message: 'Language' })}>
          {Object.entries(APP_LOCALES).map(([code, { selectorLabel }]) => (
            <button key={code} className={`lang-btn ${language === code ? 'active' : ''}`} aria-pressed={language === code} onClick={() => changeLanguage(code)}>{selectorLabel}</button>
          ))}
        </div>
      </div>

      <header className="header">
        <div className="slogan-chars">{labels.slogan}</div>
        <h1 className="theme-title">{t({ id: 'app.title', message: "Be Aware n' Be Around" })}</h1>
        <div className="subtitle-box">
          <div className="subtitle-primary">{labels.subtitle}</div>
          <div className="subtitle-secondary">{labels.secondarySubtitle}</div>
        </div>
        <ViewCounter
          endpointUrl={import.meta.env.VITE_VISIT_COUNTER_URL}
          targetUrl={window.location.href}
          autoTrack={true}
          installId={getInstallId()}
          className="counter-box"
          label={labels.clicks}
        />
      </header>

      <section className="controls" aria-label={labels.mode}>
        <div className="toggle-group">
          <label htmlFor="modeSelect">{labels.mode}</label>
          <select id="modeSelect" value={mode} onChange={changeMode}>
            <option value="edu">{labels.education}</option>
            <option value="toy">{labels.toy}</option>
          </select>
        </div>
        {mode === 'toy' && <button className={`record-toggle ${recordMode ? 'active' : ''}`} onClick={toggleRecordMode}>{recordMode ? labels.recordOn : labels.recordOff}</button>}
      </section>

      <section className="grid" aria-label={t({ id: 'actions.ariaLabel', message: 'First aid actions' })}>
        {labels.buttons.map((label, index) => <button key={label} className={`btn-toy button-${index + 1} ${toyRecordings.recordingId === index + 1 ? 'recording-pulse' : ''}`} onClick={() => activateAction(index + 1)}>{label}</button>)}
      </section>

      <p className="status" aria-live="polite">{status}</p>

      <section className="youtube-container">
        <div className="youtube-label">{t({ id: 'video.label', message: '▶️ Acute Seizure Management Animation' })}</div>
        <iframe src="https://www.youtube.com/embed/g9909mQ2dRo?iv_load_policy=3&rel=0&modestbranding=1" title={t({ id: 'video.title', message: 'Acute Seizure Animation' })} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      </section>

      <section className="instruction-box">
        <h2>{labels.guideTitle}</h2>
        <p><strong>{labels.buttons[0]}:</strong> {t({ id: 'guide.step1', message: 'Stay calm and time the seizure.' })}</p>
        <p><strong>{labels.buttons[1]}:</strong> {t({ id: 'guide.step2', message: 'Observe and keep the person safe. Clear hard objects and cushion their head.' })}</p>
        <p><strong>{labels.buttons[2]}:</strong> {t({ id: 'guide.step3', message: 'Gently roll the person onto their side. Never put anything in their mouth.' })}</p>
        <p><strong>{labels.buttons[3]}:</strong> {t({ id: 'guide.step4', message: 'Seek help. Stay with them until fully conscious, and call an ambulance if over 5 minutes.' })}</p>
      </section>

      <div className="install-row">
        <ContentPanel className="setup-guide" summary={labels.setup}>
          <h3>{t({ id: 'setup.installHeading', message: 'How to Install' })}</h3>
          <ul><li><strong>{t({ id: 'setup.iosLabel', message: 'iPhone (iOS):' })}</strong> {t({ id: 'setup.iosInstructions', message: 'Open in Safari, tap Share, then select Add to Home Screen.' })}</li><li><strong>{t({ id: 'setup.androidLabel', message: 'Android:' })}</strong> {t({ id: 'setup.androidInstructions', message: 'Open in Chrome, use the menu, then select Add to Home screen.' })}</li></ul>
          <h3>{t({ id: 'setup.operateHeading', message: 'How to Operate' })}</h3>
          <ul><li><strong>{labels.education}:</strong> {t({ id: 'setup.educationInstructions', message: 'Tap a button to hear the clinical instruction for that step.' })}</li><li><strong>{labels.toy}:</strong> {t({ id: 'setup.toyInstructions', message: 'Turn Record Mode on, tap a button to record for up to 60 seconds, then turn it off to play recordings.' })}</li></ul>
        </ContentPanel>
        <button className="install-btn-small" onClick={installApp}>{labels.install}</button>
      </div>

      <ContentPanel className="what-is-guide" summary={labels.whatIs}>
        <p>{t({ id: 'whatIs.tagline1', message: 'Be Aware of the time. Be Around for the safe recovery.' })}</p>
        <p>{t({ id: 'whatIs.tagline2', message: "Be Aware: Don't restrain. Be Around: Protect and remain." })}</p>
        <p>{t({ id: 'whatIs.tagline3', message: 'Aware of what to do, Around when it matters most.' })}</p>
        <h3>{t({ id: 'whatIs.awareHeading', message: 'Be Aware (Mental Vigilance & Safety Knowledge)' })}</h3>
        <ul><li><strong>{t({ id: 'whatIs.recognizeLabel', message: 'Recognize & Time:' })}</strong> {t({ id: 'whatIs.recognizeText', message: 'Note when the seizure starts; call emergency services if it exceeds 5 minutes.' })}</li><li><strong>{t({ id: 'whatIs.dontsLabel', message: "Know the Don'ts:" })}</strong> {t({ id: 'whatIs.dontsText', message: "Never restrain movement or place anything in the person's mouth." })}</li><li><strong>{t({ id: 'whatIs.environmentLabel', message: 'Assess Environment:' })}</strong> {t({ id: 'whatIs.environmentText', message: 'Spot physical hazards such as sharp corners, water, or stairs.' })}</li></ul>
        <h3>{t({ id: 'whatIs.aroundHeading', message: 'Be Around (Physical Protection & Care)' })}</h3>
        <ul><li><strong>{t({ id: 'whatIs.secureLabel', message: 'Secure the Surroundings:' })}</strong> {t({ id: 'whatIs.secureText', message: 'Clear hard objects and cushion their head.' })}</li><li><strong>{t({ id: 'whatIs.positionLabel', message: 'Position safely:' })}</strong> {t({ id: 'whatIs.positionText', message: 'Turn the person gently onto their side to keep their airway clear.' })}</li><li><strong>{t({ id: 'whatIs.supportLabel', message: 'Provide Support:' })}</strong> {t({ id: 'whatIs.supportText', message: 'Stay until the person is fully alert and offer calm reassurance.' })}</li></ul>
      </ContentPanel>
      <ContentPanel className="faq-guide" summary={labels.faq}>
        <h3>{t({ id: 'faq.question1', message: 'Q1: Why is text-to-speech not working?' })}</h3>
        <p>{t({ id: 'faq.answer1', message: "This app uses your phone's built-in text-to-speech engine. Download the required voice package, disable silent mode, and raise media volume." })}</p>
        <h3>{t({ id: 'faq.question2', message: 'Q2: What if voice recording fails?' })}</h3>
        <p>{t({ id: 'faq.answer2', message: 'Recording needs microphone permission. Allow browser microphone access and ensure the device is not muted.' })}</p>
        <h3>{t({ id: 'faq.question3', message: 'Q3: Can I use the app offline?' })}</h3>
        <p>{t({ id: 'faq.answer3', message: 'Install this PWA or add it to your home screen after a successful first load.' })}</p>
        <h3>{t({ id: 'faq.question4', message: 'Q4: How does the global click counter work?' })}</h3>
        <p>{t({ id: 'faq.answer4', message: 'The counter is currently a local demonstration counter stored on this device.' })}</p>
      </ContentPanel>

      <footer className="footer-linktree"><a href="https://linktr.ee/EpilepsyFoundationOfHongKong" target="_blank" rel="noopener noreferrer" className="linktree-btn">{t({ id: 'footer.linkLabel', message: '🔗 Learn more about Epilepsy Foundation HK' })}</a></footer>
    </main>
  );
}
