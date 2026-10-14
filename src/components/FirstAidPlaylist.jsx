import { useEffect, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';
import { isIOS } from '../services/install';
import './FirstAidPlaylist.css';

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

// Formats seconds as m:ss; unknown or invalid positions fall back to 0:00 so
// NaN/Infinity from the media element can never reach the UI.
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

// The playlist card for the four first-aid recordings. Rows call only the
// counted onSelectTrack callback; transport and settings controls call the
// player commands directly and never count clicks. The component creates no
// Audio, touches no storage, and resolves no source paths itself.
export function FirstAidPlaylist({ tracks, player, onSelectTrack }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const settingsButtonRef = useRef(null);

  const selectedIndex = tracks.findIndex((track) => track.id === player.selectedId);
  const hasDuration = Number.isFinite(player.duration) && player.duration > 0;
  // While a track is loading or playing, the play button offers pause; the
  // row-level "now playing" badge is only for the audible phase.
  const isBusy = player.phase === 'playing' || player.phase === 'loading';
  const volumeSupported = !isIOS();

  // Escape and outside pointer-down close the settings panel; Escape also
  // returns focus to the toggle (same pattern as the app language menu).
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        settingsButtonRef.current?.focus();
      }
    };
    const handlePointerDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setSettingsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [settingsOpen]);

  const seekLabel = t({ id: 'playlist.seek', message: 'Playback position' });
  const statusText = player.phase === 'loading'
    ? t({ id: 'playlist.loading', message: 'Loading…' })
    : player.phase === 'error'
      ? t({ id: 'playlist.error', message: 'Playback failed. Press play to try again.' })
      : '';

  return (
    <section className="playlist-card" aria-label={t({ id: 'playlist.cardLabel', message: 'First aid audio guide' })}>
      <ul className="playlist-rows">
        {tracks.map((track, index) => {
          const isSelected = track.id === player.selectedId;
          const isPlayingRow = isSelected && player.phase === 'playing';
          return (
            <li key={track.id}>
              <button
                type="button"
                className={`playlist-row playlist-row-${index + 1}${isSelected ? ' selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => onSelectTrack(track.id)}
              >
                <span className="playlist-tile">{track.label}</span>
                {' '}
                <span className="playlist-instruction">{track.instruction}</span>
                {isSelected && <span className="playlist-selected-mark" aria-hidden="true">✓</span>}
                {isPlayingRow && (
                  <span className="playlist-playing-badge" aria-hidden="true"><span /><span /><span /></span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="playlist-controls">
        <div className="playlist-transport">
          <button
            type="button"
            className="playlist-btn"
            aria-label={t({ id: 'playlist.previous', message: 'Previous' })}
            disabled={selectedIndex <= 0}
            onClick={() => player.previous()}
          >
            ⏮
          </button>
          <button type="button" className="playlist-btn playlist-btn-play" onClick={() => player.togglePlayback()}>
            {isBusy ? t({ id: 'playlist.pause', message: 'Pause' }) : t({ id: 'playlist.play', message: 'Play' })}
          </button>
          <button
            type="button"
            className="playlist-btn"
            aria-label={t({ id: 'playlist.next', message: 'Next' })}
            disabled={selectedIndex === -1 || selectedIndex >= tracks.length - 1}
            onClick={() => player.next()}
          >
            ⏭
          </button>
        </div>

        <div className="playlist-settings" ref={settingsRef}>
          <button
            type="button"
            ref={settingsButtonRef}
            className="playlist-btn"
            aria-expanded={settingsOpen}
            aria-controls="playlist-settings-panel"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <span aria-hidden="true">⚙</span>
            {' '}
            {t({ id: 'playlist.settings', message: 'Settings' })}
          </button>
          {settingsOpen && (
            <div id="playlist-settings-panel" role="group" aria-label={t({ id: 'playlist.settings', message: 'Settings' })} className="playlist-settings-panel">
              <div className="playlist-setting" role="group" aria-label={t({ id: 'playlist.speed', message: 'Speed' })}>
                <div className="playlist-setting-name">{t({ id: 'playlist.speed', message: 'Speed' })}</div>
                <div className="playlist-choices">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className="playlist-choice"
                      aria-pressed={player.playbackRate === rate}
                      onClick={() => player.setPlaybackRate(rate)}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="playlist-setting" role="group" aria-label={t({ id: 'playlist.repeat', message: 'Repeat' })}>
                <div className="playlist-setting-name">{t({ id: 'playlist.repeat', message: 'Repeat' })}</div>
                <div className="playlist-choices">
                  {[
                    ['off', t({ id: 'playlist.repeatOff', message: 'Repeat off' })],
                    ['all', t({ id: 'playlist.repeatAll', message: 'Repeat all' })],
                    ['one', t({ id: 'playlist.repeatOne', message: 'Repeat one' })],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className="playlist-choice"
                      aria-pressed={player.repeatMode === mode}
                      onClick={() => player.setRepeatMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="playlist-seek">
          <span className="playlist-time">{formatTime(player.currentTime)}</span>
          <input
            type="range"
            className="playlist-seek-range"
            min={0}
            max={hasDuration ? player.duration : 0}
            step="any"
            value={hasDuration ? Math.min(player.currentTime, player.duration) : 0}
            disabled={!hasDuration}
            aria-label={seekLabel}
            aria-valuetext={hasDuration ? `${formatTime(player.currentTime)} / ${formatTime(player.duration)}` : undefined}
            onChange={(event) => player.seek(Number(event.target.value))}
          />
          <span className="playlist-time">{formatTime(player.duration)}</span>
        </div>

        {volumeSupported ? (
          <div className="playlist-volume">
            <button
              type="button"
              className="playlist-btn"
              aria-label={player.muted
                ? t({ id: 'playlist.unmute', message: 'Unmute' })
                : t({ id: 'playlist.mute', message: 'Mute' })}
              aria-pressed={player.muted}
              onClick={() => player.setMuted(!player.muted)}
            >
              {player.muted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              className="playlist-volume-range"
              min={0}
              max={1}
              step={0.05}
              value={player.volume}
              aria-label={t({ id: 'playlist.volume', message: 'Volume' })}
              onChange={(event) => player.setVolume(Number(event.target.value))}
            />
          </div>
        ) : (
          <p className="playlist-device-volume">
            {t({ id: 'playlist.deviceVolume', message: "Use your device's volume buttons to adjust the volume." })}
          </p>
        )}
      </div>

      <p className="playlist-status" role="status">{statusText}</p>
    </section>
  );
}
