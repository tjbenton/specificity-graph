'use strict'


if (typeof window === 'undefined') {
  console.log('d3 requires a browser to run. EXITING')
  throw new Error
}

import d3 from 'd3'
import to from 'to-js'
import generateCssData from './generateCssData'

export default class SpecificityGraph {
  constructor(options) {
    this.specificity_data = {}
    this.min_val = 0 //same for x/y
    this.max_val_y = 100
    this.x = undefined
    this.y = undefined
    this.index = 0

    this.options = to.extend({
      width: 1000,
      height: 400,
      padding: {
        top: 40,
        right: 60,
        bottom: 40,
        left: 60
      },
      selector: '.js-graph',
      ticks: false,
      x_name: 'selectorIndex', // selectorIndex, line
      y_name: 'specificity', // specificity
      // linear, step-before, step-after, basis, basis-open, basis-closed,
      // bundle, cardinal, cardinal-open, cardinal-closed, monotone
      linetype: 'basis'
    }, options)

    this.created = false

    this.draw = d3.svg.line()
      .interpolate(this.options.linetype)
      .x((d, idx) => this.x(d[this.options.x_name]))
      .y((d) => this.y(d[this.options.y_name]))

    this.svg = d3.select(this.options.selector)
  }

  init() {
    const { height, width, padding, ticks, x_name } = this.options
    let axis_state = ticks ? ' is-active' : ''

    this.xAxis = d3.svg.axis().scale(this.x).tickSize(0)
    this.yAxis = d3.svg.axis().scale(this.y).tickSize(0).orient('left')

    // below elements don't change based on data
    this.svg.append('svg:g')
      .attr('class', 'axis axis--x' + axis_state)
      .attr('transform', `translate(0, ${height - padding.bottom})`)
      .call(this.xAxis) // x axis
      // Move the ticks out from the axis line
      .selectAll("text")
      .attr("transform", `translate(0, ${ticks ? 4 : 0})`)

    this.svg.append('svg:g')
      .attr('class', 'axis axis--y' + axis_state)
      .attr('transform', `translate(${padding.left}, 0)`)
      .call(this.yAxis) // y axis
      // Move the ticks out from the axis line
      .selectAll("text")
      .attr("transform", `translate(${ticks ? -4 : 0}, 0)`)

    // x domain label
    this.svg.append('svg:text')
      .attr('class', 'domain-label')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height)
      .attr('transform', `translate(0, ${padding.bottom + (ticks ? 34 : 16)})`)
      .text('Location in stylesheet')

    // y domain label
    this.svg.append('svg:text')
      .attr('class', 'domain-label')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${padding.left - (ticks ? 34 : 16)}, ${height / 2}) rotate(-90)`)
      .text('Specificity')

    // handle on mouseover focus circle and info text
    this.focus = this.svg.append('svg:g')
      .attr('class', 'focus')
      .style('display', 'none')

    this.focus.append('svg:circle')
      .attr('r', 4.5)

    this.focus.append('svg:rect')
      .attr('class', 'focus-text-background js-focus-text-background')
      .attr('width', 300)
      .attr('height', 20)
      .attr('y', '-30')
      .attr('ry', '14')
      .attr('rx', '4')

    this.focus.append('svg:text')
      .attr('class', 'focus-text js-focus-text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('y', '-20')

    const self = this
    this.svg.append('svg:rect')
      .attr('class', 'overlay')
      .attr('width', width)
      .attr('height', height)
      .on('mouseout', () => this.focus.style('display', 'none'))
      .on('mousemove', function () {
        let x0 = self.x.invert(d3.mouse(this)[0])
        let i = d3.bisector((d) => d[x_name]).right(self.specificity_data, x0)
        let d0 = self.specificity_data[i - 1]
        let d1 = self.specificity_data[i]
        let newIndex

        //check which value we're closer to (if within bounds)
        if (typeof d0 === 'undefined') {
          if (typeof d1 === 'undefined') return
          newIndex = i
        } else if (typeof d1 ==='undefined') {
          newIndex = i - 1
        } else {
          if (x0 - d0[x_name] > d1[x_name] - x0) {
            newIndex = i
          } else {
            newIndex = i - 1
          }
        }
        self.updateFocus(newIndex)
      })

    this.created = true
  }

  pathFromString(str) {
    this.pathFromData(generateCssData(str))
  }

  pathFromData(data) {
    const { height, width, padding, y_name, x_name } = this.options
    this.specificity_data = data || this.specificity_data
    this.max_val_y = Math.max(100, d3.max(this.specificity_data, (d) => d[y_name]))

    this.x = d3.scale.linear()
      .range([ padding.left, width - padding.right ])
      .domain([
        this.min_val,
        d3.max(this.specificity_data, (d, idx) => d[x_name])
      ])

    this.y = d3.scale.linear()
      .range([ height - padding.top, padding.bottom ])
      .domain([ this.min_val, this.max_val_y ])

    if (!this.created) {
      this.init()
    }

    return
  }

  css(str) {
    this.add(str)
  }

  add(str, id) {
    this.pathFromString(str)
    id = id || this.paths.length

    this.svg.append('svg:path')
      .attr('d', this.draw(this.specificity_data))
      .attr('class', `line-path line-path--${id}`)
  }

  remove(id) {
    document.querySelector(`${this.options.selector} .line-path--${id}`).remove()
  }

  get paths() {
    return [].slice.call(document.querySelectorAll(`${this.options.selector} .line-path`))
  }

  replaceWith(str, id, duration = 1000) {
    let paths = this.paths
    paths
      .slice(0, -1)
      .forEach((line) => line.remove())

    this.pathFromString(str)

    id = id || paths.length


    this.svg.select('.line-path')
      .transition()
      .duration(duration)
      .ease('linear')
      .attr('d', this.draw(this.specificity_data))
      .attr('class', `line-path line-path--${id}`)
  }

  nextFocus() {
    this.updateFocus(this.index + 1)
  }

  prevFocus() {
    this.updateFocus(this.index - 1)
  }


  updateFocus(index) {
    this.index = index = Math.min(Math.max(0, index), this.specificity_data.length - 1)

    this.focus.style('display', null)
    let d = this.specificity_data[this.index]
    this.focus.attr('transform', `translate(${this.x(d[this.options.x_name])}, ${this.y(d[this.options.y_name])})`)
    let t = this.focus.select('.js-focus-text')

    if (d.selectors && d.specificity) {
      t.text(`${d.selectors }: ${d.specificity}`)

      let w = t[0][0].getBBox().width + 20

      this.focus
        .select('.js-focus-text-background')
        .attr('width', w)
        .attr('x', -w / 2)
    }
  }
}
