/**
 * Color tokens for LingoLeaf theme
 * Natural "leaf green" palette with warm neutrals
 */

export const colors = {
  // Primary palette
  primary: '#4A9B6F',      // Leaf green
  primaryLight: '#6BB88E',
  primaryDark: '#357A54',
  
  // Backgrounds
  background: '#F5F5F0',   // Warm off-white
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  
  // Text
  text: '#1A1A1A',         // Near-black
  textSecondary: '#666666',
  textTertiary: '#999999',
  
  // Highlight colors
  highlightMint: '#D4F1E3',
  highlightYellow: '#FFF4CC',
  highlightPink: '#FFE5EC',
  
  // Semantic colors
  success: '#4A9B6F',
  error: '#DC3545',
  warning: '#FFC107',
  info: '#17A2B8',
  
  // UI elements
  border: '#E0E0E0',
  divider: '#F0F0F0',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Interactive states
  ripple: 'rgba(74, 155, 111, 0.12)',
  disabled: '#CCCCCC',
} as const;

