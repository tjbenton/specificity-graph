'use strict'


if (typeof window === 'undefined') {
  console.log('d3 requires a browser to run. EXITING')
  throw new Error
}

import d3 from 'd3'

d3.selection.prototype.moveToFront = function() {
  return this.each(function() {
    this.parentNode.appendChild(this);
  });
};
d3.selection.prototype.first = function() {
  return d3.select(this[0][0]);
};
d3.selection.prototype.last = function() {
  return d3.select(this[0][this.size() - 1]);
};

import to from 'to-js'
import generateCssData from './generateCssData'

class SpecificityGraph {
  constructor(options) {
    this.specificity_data = []
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
      dots: true,
      scaleToFit: false,
      fill: false, // close the path or use a line
      selector: '.js-graph',
      ticks: false,
      x_name: 'selectorIndex', // selectorIndex, line
      y_name: 'specificity', // specificity
      // linear, step-before, step-after, basis, basis-open, basis-closed,
      // bundle, cardinal, cardinal-open, cardinal-closed, monotone
      linetype: 'monotone'
    }, options)

    this.created = false

    this.draw = d3.svg.line()
      .x((d, idx) => this.x(d[this.options.x_name]))
      .y((d) => this.y(d[this.options.y_name]))
      .interpolate(this.options.linetype)

    this.svg = d3.select(this.options.selector)
  }

  init() {
    const { height, width, padding, ticks, x_name } = this.options
    let axis_state = ticks ? ' is-active' : ''

    this.xAxis = d3.svg.axis().scale(this.x).tickSize(0)
    this.yAxis = d3.svg.axis().scale(this.y).tickSize(0).orient('left')

    // below elements don't change based on data
    this.svg.append('g')
      .attr({
        class: 'axis axis--x' + axis_state,
        transform: `translate(0, ${height - padding.bottom})`,
      })
      .call(this.xAxis) // x axis
      // Move the ticks out from the axis line
      .selectAll("text")
      .attr("transform", `translate(0, ${ticks ? 4 : 0})`)

    this.svg.append('g')
      .attr({
        class: 'axis axis--y' + axis_state,
        transform: `translate(${padding.left}, 0)`,
      })
      .call(this.yAxis) // y axis
      // Move the ticks out from the axis line
      .selectAll("text")
      .attr("transform", `translate(${ticks ? -4 : 0}, 0)`)

    // x domain label
    this.svg.append('text')
      .attr({
        class: 'domain-label',
        'text-anchor': 'middle',
        transform: `translate(${width / 2}, ${height - padding.bottom + (ticks ? 34 : 16)})`,
      })
      .text('Location in stylesheet')

    // y domain label
    this.svg.append('text')
      .attr({
        class: 'domain-label',
        'text-anchor': 'middle',
        transform: `translate(${padding.left - (ticks ? 34 : 16)}, ${height / 2}) rotate(-90)`,
      })
      .text('Specificity')

    // handle on mouseover focus circle and info text
    this.focus = this.svg.append('g')
      .attr('class', 'focus')
      .style('display', 'none')

    this.focus.append('circle')
      .attr('r', 4.5)

    this.focus.append('rect')
      .attr({
        class: 'focus-text-background js-focus-text-background',
        width: 300,
        height: 20,
        y: '-30',
        ry: '14',
        rx: '4',
      })

    this.focus.append('text')
      .attr({
        class: 'focus-text js-focus-text',
        'text-anchor': 'middle',
        dy: '0.35em',
        y: '-20',
      })

    const self = this
    this.svg.append('rect')
      .attr({
        class: 'overlay',
        width,
        height,
      })
      .on('mouseout', () => this.focus.style('display', 'none'))
      .on('mouseover', () => this.focus.moveToFront())
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
    this.pathFromData(this.generateCssData(str))
  }

  generateCssData(str) {
    let data = generateCssData(str)

    if (!this.options.fill) {
      return data.slice(1, -1)
    }

    return data
  }

  pathFromData(data) {
    const { height, width, padding, y_name, x_name, linetype } = this.options
    data = data || this.specificity_data

    if (this.options.scaleToFit) {
      let result = []
      let first = data.shift()
      let last = data.pop()
      let x = data.length / (width - 2)

      if (x) {
        // loop through the data and filter get `x` items and then find the one
        // with the most `y_name` and then push that to the result
        // this is in here to prevent to many points from forming
        for (let i = 0; i < data.length; i += x) {
          result.push((data.slice(i, i + x) || []).sort((a, b) => a[y_name] < b[y_name])[0]);
        }

        data = result.filter(Boolean)
      }

      data.unshift(first)
      data.push(last)
    }

    this.specificity_data = data

    this.max_val_y = Math.max(100, d3.max(this.specificity_data, (d) => d[y_name]))

    this.x = d3.scale.linear()
      .range([ padding.left, width - padding.right ])
      .domain([
        this.min_val,
        d3.max(this.specificity_data, (d, idx) => d[x_name])
      ])
      .nice()

    this.y = d3.scale.linear()
      .range([ height - padding.top, padding.bottom ])
      .domain([ this.min_val, this.max_val_y ])
      .nice()

    if (!this.created) {
      this.init()
    }

    return
  }

  css(str) {
    this.add(str)
  }

  group(id) {
    const group = this.svg.append('g')
      .attr({
        class: `group group--${id}`
      })

    group
      .append('path')
      .attr('class', 'line-path')

    group
      .append('g')
      .attr('class', 'dots')
    return group
  }

  add(str, id) {
    this.pathFromString(str)
    id = id || this.groups.length
    const group = this.group(id)

    group
      .select('.line-path')
      .attr({
        d: this.draw(this.specificity_data),
        class: `line-path`
      })

    if (this.options.dots) {
      group
        .select('.dots')
        .selectAll('dot')
        .data(this.specificity_data)
        .enter()
        .append('circle')
        .attr({
          class: 'dots__dot',
          'stroke-miterlimit': 10,
          r: '1.5',
          cx: (d) => this.x(d[this.options.x_name]),
          cy: (d) => this.y(d[this.options.y_name]),
        })
    }
  }

  remove(id) {
    document.querySelector(`${this.options.selector} .group--${id}`).remove()
  }

  get groups() {
    return this.svg.selectAll('.group')
  }

  replaceWith(str, id, duration = 500) {
    this.groups.slice(0, -1).forEach((group) => group.remove())

    let prev = this.specificity_data

    this.pathFromString(str)

    id = id || this.groups.length
    let group = this.groups.last()

    group
      .select('.line-path')
      .transition()
      .duration(duration / 6)
      .attr('d', this.draw(this.fakeData(prev)))
      .transition()
      .attr('d', this.draw(this.fakeData(this.specificity_data)))
      .transition()
      .duration(duration / 2)
      .ease('linear')
      .attr({
        d: this.draw(this.specificity_data),
        class: 'line-path'
      })

    if (this.options.dots) {
      let prev_circles = this.specificity_data.map((item, i) => prev[i] ? prev[i] : item)

      let drawDot = {
        class: 'dots__dot',
        'stroke-miterlimit': 10,
        r: '1.5',
        cx: (d) => this.x(d[this.options.x_name]),
        cy: (d) => this.y(d[this.options.y_name]),
      }

      let dots = group.select('.dots')
      group.selectAll('.dots__dot').remove() // remove all the dots

      dots
        .selectAll('dot')
        .data(prev_circles)
        .enter()
        .append('circle')
        .attr(drawDot)

      dots
        .selectAll('.dots__dot')
        .data(this.specificity_data)
        .transition()
        .attr(drawDot)
    }
  }

  fakeData(data, modifier = 2) {
    return data.map((data) => {
      data = to.clone(data)
      data.specificity = (data.specificity / modifier)
      return data
    })
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
    this.focus
      .attr('transform', `translate(${this.x(d[this.options.x_name])}, ${this.y(d[this.options.y_name])})`)

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

function movingAvg(n) {
  return (points) => {
    const first = points.shift()
    const last = points.pop()
    points = points.map((each, index, array) => {
      const to = index + n - 1
      let subSeq, sum
      if (to < points.length) {
        subSeq = array.slice(index, to + 1)
        sum = subSeq.reduce((a, b) => [a[0] + b[0], a[1] + b[1]])
        return sum.map((each) => each / n)
      }
      return
    })
    points = points.filter((each) => typeof each !== 'undefined')
    points.unshift(first)
    points.push(last)
    // Note that one could re-interpolate the points
    // to form a basis curve (I think...)
    return points.join('L')
  }
}

SpecificityGraph.movingAvg = movingAvg

module.exports = SpecificityGraph
// {
//   SpecificityGraph,
//   'default': SpecificityGraph,
//   movingAvg
// }