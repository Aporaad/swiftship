import supabaseRulesPlugin from '@supabase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  supabaseRulesPlugin.configs['flat/recommended']
];
