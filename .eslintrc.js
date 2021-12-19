module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    extends: ['eslint:recommended', 'prettier'],
    overrides: [
        // typescript
        {
            files: ['*.ts', '*.tsx'],
            plugins: ['@typescript-eslint'],
            extends: ['plugin:@typescript-eslint/recommended'],
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
                '@typescript-eslint/no-explicit-any': 'off'
            }
        },
        // javascript
        {
            files: ['./tasks/**/*.js', 'jfrog-tasks-utils/*.js'],
            env: {
                node: true
            }
        }
    ]
};
