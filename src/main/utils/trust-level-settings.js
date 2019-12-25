const trustLevelSettings = {
    'low': ['$redirect', 'rewrite:abp-resource'],
    'high': ['$redirect', 'rewrite:abp-resource', '#%#//scriptlet', '##+js', '#$#'],
    'full': ['$redirect', 'rewrite:abp-resource', '#%#//scriptlet', '##+js', '#$#', '$replace', '#%#', '#@%#']
}

module.exports = trustLevelSettings;