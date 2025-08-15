import React from 'react'

interface ModelIconProps {
  provider: string
  model?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Brandfetch logo URLs with company IDs
const BRANDFETCH_LOGOS = {
  'OpenAI': 'https://cdn.brandfetch.io/openai.com/w/512/h/512?c=1idsS8q4iUoQJpiX7Hr',
  'Anthropic': 'https://cdn.brandfetch.io/anthropic.com/w/400/h/400?c=1idsS8q4iUoQJpiX7Hr',
  'Google': 'https://cdn.brandfetch.io/google.com/w/400/h/400?c=1idsS8q4iUoQJpiX7Hr',
  'Mistral': 'https://cdn.brandfetch.io/mistral.ai/w/200/h/200?c=1idsS8q4iUoQJpiX7Hr'
}

// Provider configurations
const PROVIDER_CONFIG = {
  'OpenAI': {
    logoUrl: BRANDFETCH_LOGOS.OpenAI,
  },
  'Anthropic': {
    logoUrl: BRANDFETCH_LOGOS.Anthropic,
  },
  'Google': {
    logoUrl: BRANDFETCH_LOGOS.Google,
  },
  'Mistral': {
    logoUrl: BRANDFETCH_LOGOS.Mistral,
  }
}

// Model-specific icons for OpenAI (others use provider logo)
const OPENAI_MODEL_VARIANTS = {
  'GPT-4': { symbol: '4', bg: 'bg-purple-600' },
  'GPT-4-Turbo': { symbol: '4T', bg: 'bg-blue-600' },
  'GPT-3.5-Turbo': { symbol: '3.5', bg: 'bg-green-600' },
  'DALL-E 3': { symbol: 'DE', bg: 'bg-pink-600' },
}

export function ModelIcon({ provider, model, size = 'md', className = '' }: ModelIconProps) {
  const config = PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG] || PROVIDER_CONFIG['OpenAI']
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-10 h-10'
  }
  
  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24
  }

  // Special handling for OpenAI models with different variants
  if (provider === 'OpenAI' && model && OPENAI_MODEL_VARIANTS[model as keyof typeof OPENAI_MODEL_VARIANTS]) {
    const variant = OPENAI_MODEL_VARIANTS[model as keyof typeof OPENAI_MODEL_VARIANTS]
    return (
      <div className={`
        ${variant.bg}
        text-white
        ${sizeClasses[size]}
        rounded-full
        flex items-center justify-center
        font-bold text-xs
        ${className}
      `}>
        {variant.symbol}
      </div>
    )
  }

  return (
    <div className={`
      ${sizeClasses[size]}
      rounded-full
      flex items-center justify-center
      ${className}
    `}>
      <img 
        src={config.logoUrl}
        alt={provider}
        width={iconSizes[size]}
        height={iconSizes[size]}
        className="w-full h-full object-cover rounded-full"
        onError={(e) => {
          // Fallback to a simple text icon if Brandfetch fails
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.textContent = provider.charAt(0);
          fallback.className = 'w-full h-full flex items-center justify-center font-bold';
          target.parentNode?.appendChild(fallback);
        }}
      />
    </div>
  )
}

export function ProviderIcon({ provider, size = 'md', className = '' }: Omit<ModelIconProps, 'model'>) {
  return <ModelIcon provider={provider} size={size} className={className} />
}
