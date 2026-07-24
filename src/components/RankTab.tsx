import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Shield, Flame, Zap, Award, CheckCircle2, Lock, Plus, RotateCcw, Activity } from 'lucide-react';
import { RANK_TIERS, getRankProgressInfo, formatStudyTime, RankTier } from '../utils/rank-system';
import { ClassificationResult } from '../utils/content-classifier';

interface RankTabProps {
  totalStudySeconds: number;
  onUpdateStudySeconds: (newSeconds: number) => void;
  currentClassification: ClassificationResult | null;
  currentTitle: string;
}

export default function RankTab({
  totalStudySeconds,
  onUpdateStudySeconds,
  currentClassification,
  currentTitle
}: RankTabProps) {
  const hours = totalStudySeconds / 3600;
  const progressInfo = getRankProgressInfo(hours);
  const { currentRank, nextRank, progressPercent, hoursRemainingToNext } = progressInfo;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load video URL for current rank
  useEffect(() => {
    async function loadVideo() {
      if (window.electronAPI && window.electronAPI.getRankVideoUrl) {
        const url = await window.electronAPI.getRankVideoUrl(currentRank.videoFileName);
        setVideoUrl(url);
      }
    }
    loadVideo();
  }, [currentRank.videoFileName]);

  // Ensure video plays smoothly when loaded
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(err => console.log('[FocusBro] Video autoplay issue:', err));
    }
  }, [videoUrl]);

  const handleAddHours = (addHours: number) => {
    const newSeconds = Math.max(0, totalStudySeconds + addHours * 3600);
    onUpdateStudySeconds(newSeconds);
  };

  const handleReset = () => {
    onUpdateStudySeconds(0);
  };

  return (
    <div className="rank-tab-container">
      {/* Header */}
      <div className="rank-header">
        <div className="rank-header-title">
          <Trophy className="rank-header-icon" size={24} />
          <div>
            <h2>Rank & Study Progression</h2>
            <p className="rank-subtitle">Earn ranks by watching lectures, solving LeetCode/problems, & studying</p>
          </div>
        </div>
      </div>

      {/* Live Status Banner */}
      <div className={`rank-status-banner ${currentClassification?.isStudy ? 'active' : 'idle'}`}>
        <div className="status-indicator">
          <span className={`status-dot ${currentClassification?.isStudy ? 'pulse-green' : 'dim'}`} />
          <span className="status-label">
            {currentClassification?.isStudy ? 'STUDY / CODING SESSION ACTIVE' : 'IDLE / NON-STUDY CONTENT'}
          </span>
        </div>
        <div className="status-details">
          {currentClassification?.isStudy ? (
            <span className="status-reason">
              <Activity size={13} style={{ marginRight: 4 }} />
              {currentClassification.reason}
            </span>
          ) : (
            <span className="status-reason dim">
              {currentClassification?.reason || 'Open a coding site or educational lecture to earn rank XP'}
            </span>
          )}
        </div>
      </div>

      {/* Hero Rank Card */}
      <div className="rank-hero-card" style={{ '--rank-color': currentRank.badgeColor } as React.CSSProperties}>
        {/* Video Background / Preview Container */}
        <div className="rank-video-wrapper">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="rank-bg-video"
            />
          ) : (
            <div className="rank-video-fallback">
              <Flame size={64} color={currentRank.badgeColor} />
            </div>
          )}
          <div className="rank-video-overlay" />
        </div>

        {/* Hero Content */}
        <div className="rank-hero-content">
          <div className="rank-badge-pill" style={{ background: currentRank.badgeGradient }}>
            <Award size={16} />
            <span>CURRENT RANK</span>
          </div>

          <h1 className="rank-tier-title" style={{ color: currentRank.badgeColor }}>
            {currentRank.name}
          </h1>

          <div className="rank-stats-row">
            <div className="stat-box">
              <span className="stat-label">Total Time Tracked</span>
              <span className="stat-value">{formatStudyTime(totalStudySeconds)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Hours Accumulated</span>
              <span className="stat-value">{hours.toFixed(1)} hrs</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Next Rank Requirement</span>
              <span className="stat-value">{nextRank ? `${nextRank.requiredHours} hrs` : 'MAX RANK'}</span>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="rank-progress-section">
            <div className="progress-bar-header">
              <span>Progress to {nextRank ? nextRank.name : 'Max Tier'}</span>
              <span>{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="rank-progress-track">
              <div
                className="rank-progress-fill"
                style={{
                  width: `${progressPercent}%`,
                  background: currentRank.badgeGradient
                }}
              />
            </div>
            <div className="progress-bar-footer">
              {nextRank ? (
                <span>
                  Requires <strong>{hoursRemainingToNext.toFixed(1)} more hours</strong> of study/coding
                </span>
              ) : (
                <span className="max-rank-text">🏆 You have achieved the highest rank: RELENTLESS!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dev / Testing Controls */}
      <div className="rank-dev-controls">
        <span className="dev-label">⚡ Fast Testing / Demo Controls:</span>
        <button onClick={() => handleAddHours(1)} className="btn-dev">
          <Plus size={13} /> +1 Hr
        </button>
        <button onClick={() => handleAddHours(10)} className="btn-dev">
          <Plus size={13} /> +10 Hrs
        </button>
        <button onClick={() => handleAddHours(50)} className="btn-dev">
          <Plus size={13} /> +50 Hrs
        </button>
        <button onClick={handleReset} className="btn-dev danger">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* Tier Roadmap Grid */}
      <div className="rank-roadmap-section">
        <h3>All Ranks & Duration Thresholds</h3>
        <div className="rank-roadmap-grid">
          {RANK_TIERS.map((tier) => {
            const isUnlocked = hours >= tier.requiredHours;
            const isCurrent = tier.id === currentRank.id;

            return (
              <div
                key={tier.id}
                className={`roadmap-card ${isCurrent ? 'current' : isUnlocked ? 'unlocked' : 'locked'}`}
                style={{ '--tier-color': tier.badgeColor } as React.CSSProperties}
              >
                <div className="roadmap-card-header">
                  <div
                    className="roadmap-badge-icon"
                    style={{ background: tier.badgeGradient }}
                  >
                    {isUnlocked ? <CheckCircle2 size={14} color="#FFF" /> : <Lock size={14} color="#FFF" />}
                  </div>
                  <span className="roadmap-card-name">{tier.name}</span>
                </div>

                <div className="roadmap-card-hours">
                  {tier.requiredHours} Total Hours
                </div>

                {isCurrent && <span className="roadmap-current-tag">ACTIVE</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
