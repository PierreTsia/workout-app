import js from '@eslint/js'
import globals from 'globals'
import i18next from 'eslint-plugin-i18next'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const noCreateClient = {
  name: '@supabase/supabase-js',
  importNames: ['createClient'],
  message:
    'Un seul client Supabase : importe `supabase` depuis @/lib/supabase.',
}

const nomosPublic = {
  group: [
    '@nomosui/react/*',
    '!@nomosui/react/view',
    '!@nomosui/react/view.css',
  ],
  message:
    'Nomos : surface publique seulement (@nomosui/react, /view, /tokens/*) — jamais dist/… ou src/…',
}

const radixConfined = {
  group: ['@radix-ui/*'],
  message:
    'Radix reste confiné à src/components/ui/** : passe par une primitive locale ou @nomosui/react.',
}

const vendoredUi = {
  group: ['@/components/ui/*'],
  message:
    'Surface migrée vers Nomos : utilise @nomosui/react, pas la primitive vendorée src/components/ui/*.',
}

const forbidPages = {
  group: ['@/pages/*', '@/pages/**'],
  message:
    'Inversion de couche : cette couche ne dépend pas des pages (couche supérieure).',
}

const forbidComponents = {
  group: ['@/components/*', '@/components/**'],
  message:
    'Inversion de couche : un hook ne dépend pas des composants (couche UI supérieure).',
}

const forbidUiAndHooks = {
  group: [
    '@/components/*',
    '@/components/**',
    '@/hooks/*',
    '@/hooks/**',
  ],
  allowTypeImports: true,
  message:
    'Inversion de couche : lib/store/types/data ne dépendent ni de l’UI ni des hooks.',
}

const RESTRICT = '@typescript-eslint/no-restricted-imports'

// `no-restricted-imports` ne fusionne pas entre blocs : chaque bloc qui cible
// des fichiers doit re-déclarer la totalité des restrictions qui les concernent.
const restricted = ({ patterns = [], createClient = true, radix = true } = {}) => [
  'error',
  {
    ...(createClient ? { paths: [noCreateClient] } : {}),
    patterns: [nomosPublic, ...(radix ? [radixConfined] : []), ...patterns],
  },
]

const COLOR_CLASS =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-\[(?:#|rgba?\(|hsla?\(|oklch\()/
const colorSelector = (node, attr = 'value') =>
  `JSXAttribute[name.name="className"] ${node}[${attr}=/${COLOR_CLASS.source}/]`
const COLOR_MESSAGE =
  'Couleurs : utilise un token (bg-primary, text-muted-foreground…) — pas de couleur en dur.'
const STYLE_MESSAGE =
  'Couleurs : utilise un token — pas de couleur hex en style inline.'

const brandPages = [
  'src/pages/LoginPage.tsx',
  'src/pages/AboutPage.tsx',
  'src/pages/PrivacyPage.tsx',
  'src/pages/OAuthConsentPage.tsx',
]

export default defineConfig([
  globalIgnores([
    'dist',
    'web/dist',
    'web/.astro',
    'web/node_modules',
    'supabase/.temp',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: [
      'src/components/ui/**/*.{ts,tsx}',
      'web/src/components/ui/**/*.{ts,tsx}',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // --- Frontières d'import (archi) ---
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { [RESTRICT]: restricted() },
  },
  {
    // Le seam shadcn porte les primitives : lui seul touche Radix.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { [RESTRICT]: restricted({ radix: false }) },
  },
  {
    files: ['src/{lib,store,types,data}/**/*.{ts,tsx}'],
    rules: {
      [RESTRICT]: restricted({ patterns: [forbidUiAndHooks] }),
    },
  },
  {
    // Seul fichier autorisé à instancier le client.
    files: ['src/lib/supabase.ts'],
    rules: {
      [RESTRICT]: restricted({ createClient: false, patterns: [forbidUiAndHooks] }),
    },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: { [RESTRICT]: restricted({ patterns: [forbidPages, forbidComponents] }) },
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: ['src/components/admin/**', 'src/components/ui/**', '**/*.test.*'],
    rules: { [RESTRICT]: restricted({ patterns: [forbidPages] }) },
  },
  {
    files: ['src/components/admin/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*'],
    rules: { [RESTRICT]: restricted({ patterns: [vendoredUi, forbidPages] }) },
  },
  {
    // Les pages admin sont aussi une surface migrée vers Nomos.
    files: ['src/pages/Admin*.tsx'],
    ignores: ['**/*.test.*'],
    rules: { [RESTRICT]: restricted({ patterns: [vendoredUi] }) },
  },
  {
    // La surface agentique vit hors app (ADR 0027) : nomos + ses propres fichiers.
    files: ['src/mcp-views/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*'],
    rules: {
      [RESTRICT]: restricted({
        patterns: [
          vendoredUi,
          {
            group: [
              '@/components/*',
              '@/components/**',
              '@/pages/*',
              '@/pages/**',
              '@/hooks/*',
              '@/hooks/**',
              '@/store/*',
              '@/store/**',
              '@/lib/*',
              '@/lib/**',
              '@/data/*',
              '@/data/**',
            ],
            message:
              'mcp-views reste autonome : nomos + fichiers locaux, aucun import app (ADR 0027).',
          },
        ],
      }),
    },
  },
  {
    // Les tests traversent les couches pour observer le vrai comportement.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: { [RESTRICT]: restricted() },
  },

  // --- i18n : zéro littéral JSX en dur ---
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/components/ui/**',
      'src/mcp-views/**',
      'src/locales/**',
      'src/test/**',
      'src/**/*.test.{ts,tsx}',
      'src/**/*Playground*',
    ],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          framework: 'react',
          mode: 'jsx-text-only',
          words: {
            exclude: [
              '[0-9!-/:-@[-`{-~]+',
              '[A-Z_-]+',
              /^[\p{P}\p{S}]+$/u,
              /^\p{Emoji}+$/u,
              'min',
              's',
              'GymLogic',
            ],
          },
        },
      ],
    },
  },

  // --- Couleurs : tokens seulement, pas de couleur en dur ---
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      ...brandPages,
      'src/components/ui/**',
      'src/components/profile/charts/**',
      'src/**/*.test.{ts,tsx}',
      'src/test/**',
      'src/**/*Playground*',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: colorSelector('Literal'),
          message: COLOR_MESSAGE,
        },
        {
          selector: colorSelector('TemplateElement', 'value.raw'),
          message: COLOR_MESSAGE,
        },
        {
          selector:
            'JSXAttribute[name.name="style"] Literal[value=/#[0-9a-fA-F]{3,8}/]',
          message: STYLE_MESSAGE,
        },
      ],
    },
  },
])
