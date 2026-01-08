'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create lobby');
      }

      // Store player ID in session storage
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('playerName', playerName.trim());

      // Navigate to lobby
      router.push(`/lobby/${data.lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const response = await fetch(`/api/lobby/${joinCode.trim().toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join lobby');
      }

      // Store player ID in session storage
      sessionStorage.setItem('playerId', data.playerId);
      sessionStorage.setItem('playerName', playerName.trim());

      // Navigate to lobby
      router.push(`/lobby/${data.lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
      setIsJoining(false);
    }
  };

  return (
    <main className={styles.home}>
      <div className={styles.hero}>
        <h1 className={styles.logo}>TRES</h1>
        <p className={styles.tagline}>
          The fun multiplayer card game for your Friday game night!
        </p>
        <div className={styles.featureCards}>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>👥</span>
            2-15 players
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>🌐</span>
            Play online
          </div>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>📱</span>
            Works on any device
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.actionCard}>
          <h2 className={styles.actionTitle}>
            <span className={styles.actionIcon}>🎮</span>
            Play Now
          </h2>
          <div className={styles.formGroup}>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
            />
            <button
              className="btn btn-primary btn-lg"
              onClick={handleCreateGame}
              disabled={isCreating}
              style={{ width: '100%' }}
            >
              {isCreating ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </div>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span>or join a game</span>
          <div className={styles.dividerLine} />
        </div>

        <div className={styles.actionCard}>
          <h2 className={styles.actionTitle}>
            <span className={styles.actionIcon}>🔗</span>
            Join with Code
          </h2>
          <div className={styles.formGroup}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                className="input"
                placeholder="Enter lobby code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleJoinGame}
                disabled={isJoining}
              >
                {isJoining ? '...' : 'Join'}
              </button>
            </div>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.rules}>
        <h3 className={styles.rulesTitle}>Quick Rules</h3>
        <div className={styles.rulesList}>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>🎯</span>
            Match cards by color or number
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>⏭️</span>
            Skip, Reverse, +2 cards
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>🌈</span>
            Wild cards change color
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>🏆</span>
            First to empty hand wins!
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>⚠️</span>
            Say "TRES" at one card!
          </div>
          <div className={styles.ruleItem}>
            <span className={styles.ruleIcon}>📥</span>
            Draw if you can&apos;t play
          </div>
        </div>
      </div>
    </main>
  );
}
