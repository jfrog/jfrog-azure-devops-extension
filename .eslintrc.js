module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['eslint-plugin-jsdoc', '@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
    rules: {
        '@typescript-eslint/typedef': [
            'error',
            {
                memberVariableDeclaration: true,
                variableDeclaration: true,
                objectDestructuring: true,
                propertyDeclaration: true,
                parameter: true
            }
        ],
        'prefer-const': 'off',
        'no-extra-boolean-cast': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'jsdoc/check-alignment': 'warn',
        'jsdoc/check-indentation': 'warn',
        'jsdoc/newline-after-description': 'warn',
    }
};
