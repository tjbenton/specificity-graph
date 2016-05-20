'use strict';
import cssParse from 'css-parse'
import unminify from 'cssbeautify'
import specificity from 'specificity'
import to from 'to-js'

function specSum(selector) {
  let specs = specificity.calculate(selector)[0].specificity.split(',')
  return (parseInt(specs[0])*1000) + (parseInt(specs[1])*100) + (parseInt(specs[2])*10) + (parseInt(specs[3]))
}


export default function generateCssData(origCss) {
  let result = []
  let selectorIndex = 1
  let rules = cssParse(unminify(origCss), { silent: true }).stylesheet.rules

  for (let set of rules) {
    if (set.type === 'rule') {
      set = { rules: [ set ] }
    }

    for (let rule of (set.rules || [])) {
      let line = rule.position.start.line;

      for (let selectors of rule.selectors) {
        result.push({
          selectorIndex,
          line,
          specificity: specSum(selectors),
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