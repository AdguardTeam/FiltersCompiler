/**
 * @file
 * eslint config for the compiler
 */
module.exports = {
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    env: {
        'browser': true,
        'node': true,
        'jest': true,
    },
    settings: {
        'import/resolver': {
            exports: {},
        },
    },
    plugins: [
        'import',
    ],
    extends: [
        'airbnb-base',
    ],
    globals: {
        'adguard': true,
        'chrome': true,
        'QUnit': true,
        'browser': true,
    },
    rules: {
        'import/no-extraneous-dependencies': 0,
        'import/prefer-default-export': 0,
        'indent': [
            'error',
            4,
            {
                'SwitchCase': 1,
                'VariableDeclarator': 1,
                'outerIIFEBody': 1,
                'FunctionDeclaration': {
                    'parameters': 1,
                    'body': 1,
                },
                'FunctionExpression': {
                    'parameters': 1,
                    'body': 1,
                },
                'CallExpression': {
                    'arguments': 1,
                },
                'ArrayExpression': 1,
                'ObjectExpression': 1,
                'ImportDeclaration': 1,
                'flatTernaryExpressions': false,
                'ignoredNodes': [
                    'JSXElement',
                    'JSXElement > *',
                    'JSXAttribute',
                    'JSXIdentifier',
                    'JSXNamespacedName',
                    'JSXMemberExpression',
                    'JSXSpreadAttribute',
                    'JSXExpressionContainer',
                    'JSXOpeningElement',
                    'JSXClosingElement',
                    'JSXText',
                    'JSXEmptyExpression',
                    'JSXSpreadChild',
                ],
                'ignoreComments': false,
            },
        ],
        'no-useless-escape': 'off',
        'no-param-reassign': 'off',
        'wrap-iife': 'off',
        'func-names': 'off',
        'no-shadow': 'off',
        'arrow-body-style': 0,
        'no-multi-spaces': [
            'error',
            {
                'ignoreEOLComments': true,
            },
        ],
        // Prefer destructuring from arrays and objects
        // https://eslint.org/docs/rules/prefer-destructuring
        'prefer-destructuring': [
            'error',
            {
                'VariableDeclarator': {
                    'array': false,
                    'object': true,
                },
                'AssignmentExpression': {
                    'array': true,
                    'object': false,
                },
            },
            {
                'enforceForRenamedProperties': false,
            },
        ],
        'consistent-return': 'off',
        'no-prototype-builtins': 'off',
        'dot-notation': 'off',
        'quote-props': 'off',
        'no-continue': 'off',
        'strict': 'off',
        'no-bitwise': 'off',
        'no-underscore-dangle': 'off',
        'max-len': ['error', {
            'code': 120,
            'comments': 120,
            'tabWidth': 4,
            'ignoreUrls': true,
            'ignoreTrailingComments': false,
            'ignoreComments': false,
        }],
    },
};
