import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n/i18nContext'

// Theme = the app's accent color pair. Presets give a handful of ready-made
// choices; "custom" lets the user type any hex pair.
const PRESETS = {
  amber: { accent: '#e87003', accentHover: '#d46100' },
  blue: { accent: '#3d5aa8', accentHover: '#2f4680' },
  green: { accent: '#2e8c47', accentHover: '#256f38' },
  red: { accent: '#b3261e', accentHover: '#8f1e18' },
  dark: { accent: '#2b2b2b', accentHover: '#1a1a1a' },
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Accepts "#b3261e", "b3261e", or either with stray whitespace — typing the
// hex digits alone (no leading #) shouldn't silently do nothing.
function normalizeHex(value) {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return HEX_RE.test(withHash) ? withHash : null
}

function applyTheme(colors) {
  const root = document.documentElement.style
  root.setProperty('--accent', colors.accent)
  root.setProperty('--accent-hover', colors.accentHover)
}

// Theme is persisted via the Go backend (config.json, alongside every other
// setting) rather than browser localStorage — see gui/theme.go.
function backendGetTheme() {
  return window.go?.main?.App?.GetTheme ? window.go.main.App.GetTheme() : Promise.resolve(null)
}
function backendSaveTheme(theme) {
  if (window.go?.main?.App?.SaveTheme) window.go.main.App.SaveTheme(theme)
}

// Resolves true if a theme has already been saved. Exported so App.jsx's
// brand-loading effect can skip applying the brand's own default accent when
// a saved theme should take precedence — a saved theme choice always wins,
// regardless of which effect happens to run first.
export async function hasStoredTheme() {
  const saved = await backendGetTheme()
  return !!(saved && saved.preset)
}

// Resolves a stored theme's colors and applies them (CSS vars) — the actual
// work ThemePicker's own mount-effect does, extracted so App.jsx's startup
// effect can do it too.
export async function applyStoredTheme() {
  const saved = await backendGetTheme()
  if (!saved || !saved.preset) return
  const customColors = {
    accent: saved.accent || PRESETS.amber.accent,
    accentHover: saved.accentHover || PRESETS.amber.accentHover,
  }
  const colors = saved.preset === 'custom' ? customColors : PRESETS[saved.preset]
  if (colors) applyTheme(colors)
}

export default function ThemePicker() {
  const { t } = useTranslation()
  const [preset, setPreset] = useState('amber')
  const [custom, setCustom] = useState(PRESETS.amber)

  // Load whatever was saved (if anything) once, on mount, and actually apply
  // it — App.jsx's own brand-loading effect only SKIPS setting its default
  // accent when a theme is stored (see hasStoredTheme); it never applies one
  // itself, so this is the one place a saved theme takes effect on startup.
  useEffect(() => {
    let cancelled = false
    backendGetTheme().then((saved) => {
      if (cancelled || !saved || !saved.preset) return
      setPreset(saved.preset)
      const customColors = {
        accent: saved.accent || PRESETS.amber.accent,
        accentHover: saved.accentHover || PRESETS.amber.accentHover,
      }
      const colors = saved.preset === 'custom' ? customColors : PRESETS[saved.preset]
      if (saved.preset === 'custom') setCustom(customColors)
      if (colors) applyTheme(colors)
    }).catch(() => {
      // Backend unavailable (dev preview without Wails) — keep CSS defaults.
    })
    return () => { cancelled = true }
  }, [])

  const save = (nextPreset, nextCustom) => {
    backendSaveTheme({ preset: nextPreset, ...nextCustom })
  }

  const pick = (name) => {
    setPreset(name)
    const colors = name === 'custom' ? custom : PRESETS[name]
    applyTheme(colors)
    save(name, custom)
  }

  const editCustomField = (field, value) => {
    const next = { ...custom, [field]: value }
    setCustom(next)
    // Only apply/persist a well-formed hex — a half-typed value stays in the
    // input but doesn't flash broken colors across the app while typing.
    const normalized = normalizeHex(value)
    if (normalized) {
      const applied = { ...next, [field]: normalized }
      applyTheme(applied)
      save('custom', applied)
    }
  }

  const activeColors = preset === 'custom' ? custom : PRESETS[preset]

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <h3 style={{ marginTop: 0 }}>{t('themeTitle')}</h3>
      <p style={{ color: '#718096', fontSize: '13px', marginBottom: '14px' }}>{t('themeIntro')}</p>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {[...Object.keys(PRESETS), 'custom'].map((name) => (
          <div
            key={name}
            onClick={() => pick(name)}
            style={{
              border: `2px solid ${preset === name ? 'var(--accent)' : '#ddd'}`,
              boxShadow: preset === name ? '0 0 0 2px rgba(232,112,3,0.15)' : 'none',
              borderRadius: '8px',
              padding: '10px',
              width: '110px',
              cursor: 'pointer',
              textAlign: 'center',
              backgroundColor: '#fff',
            }}
          >
            <div
              style={{
                height: '32px',
                borderRadius: '5px',
                marginBottom: '8px',
                background: name === 'custom' ? custom.accent : PRESETS[name].accent,
                border: name === 'custom' ? '1px dashed #999' : 'none',
              }}
            />
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
              {t(`theme${name.charAt(0).toUpperCase()}${name.slice(1)}`)}
            </div>
          </div>
        ))}
      </div>

      {preset === 'custom' && (
        <div style={{
          marginTop: '18px', padding: '14px', backgroundColor: '#fafafa',
          border: '1px solid #e2e2e2', borderRadius: '6px',
          display: 'flex', gap: '18px', flexWrap: 'wrap',
        }}>
          {[
            ['accent', 'themeFieldAccent'],
            ['accentHover', 'themeFieldAccentHover'],
          ].map(([field, labelKey]) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                {t(labelKey)}
              </label>
              <input
                value={custom[field]}
                onChange={(e) => editCustomField(field, e.target.value)}
                placeholder="#rrggbb"
                style={{ width: '110px', padding: '6px 9px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#999', width: '100%' }}>{t('themeCustomHint')}</div>
        </div>
      )}

      <div style={{ marginTop: '18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#555', marginBottom: '6px' }}>{t('themePreview')}</div>
        <div style={{
          background: activeColors.accent, color: '#fff', borderRadius: '6px',
          padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 700, fontStyle: 'italic' }}>Proxmox Backup Client — GO</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{t('tabBackup').toUpperCase()}</div>
        </div>
      </div>
    </div>
  )
}
