'use strict';
import cssParse from 'css-parse'
import unminify from 'cssbeautify'
import specificity from 'specificity'
import to from 'to-js'

function specSum(selector) {
  let specs = specificity.calculate(selector)[0].specificity.split(',')
  return (parseInt(specs[0]) * 1000) + (parseInt(specs[1]) * 100) + (parseInt(specs[2]) * 10) + (parseInt(specs[3]))
}


export default function generateCssData(origCss, include_important = false) {
  let result = []
  let selectorIndex = 1
  let rules = cssParse(unminify(origCss), { silent: true }).stylesheet.rules

  for (let set of rules) {
    if (set.type === 'rule') {
      set = { rules: [ set ] }
    }

    for (let rule of (set.rules || [])) {
      let line = rule.position.start.line;
      let important_count = 0
      let important = []
      if (include_important) {
        for (let declaration of rule.declarations) {
          if (declaration.value.indexOf('!important') > -1) {
            important_count++
            important.push(`${declaration.property}: ${declaration.value};`)
          }
        }
      }

      important_count = parseInt(important_count * 50 / rule.declarations.length)

      for (let selectors of rule.selectors) {
        let specificity = specSum(selectors)
        specificity += important_count
        result.push({
          selectorIndex,
          line,
          specificity,
          important,
          selectors
        })

        selectorIndex++
      }
    }
  }

  let last = to.clone(result.slice(-1)[0])
  last.selectorIndex++
  last.line++
  last.specificity = 0
  last.selectors = ''
  result.unshift({
    selectorIndex: 0,
    line: 1,
    specificity: 0,
    selectors: ''
  })
  result.push(last)
  return result
}