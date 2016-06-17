'use strict'


if (typeof window === 'undefined') {
  console.log('d3 requires a browser to run. EXITING')
  throw new Error
}

import d3 from 'd3'

d3.selection.prototype.moveToFront = function() {
  return this.each(function() {
    this.parentNode.appendChild(this)
  })
}
d3.selection.prototype.first = function() {
  return d3.select(this[0][0])
}
d3.selection.prototype.last = function() {
  return d3.select(this[0][this.size() - 1])
}

// https://gist.github.com/ZJONSSON/3918369
d3.legend = (g) => {
  g.each(function() {
    const g = d3.select(this)
    let items = {}
    let svg = d3.select(g.property('nearestViewportElement'))
    let block = g.attr('data-name') || g.attr('class').split(' ')[0] || 'legend'
    let legendPadding = g.attr('data-style-padding') || 5
    let lb = g.selectAll(`.${block}__box`).data([ true ])
    let li = g.selectAll(`.${block}__items`).data([ true ])

    lb.enter().append('rect').classed(`${block}__box`, true)
    li.enter().append('g').classed(`${block}__items`, true)
    li.selectAll(`.${block}__item`).remove() // remove existing items

    svg.selectAll(`[data-${block}]`).each(function() {
      const self = d3.select(this)
      const name = self.attr(`data-${block}`)
      items[name] = items[name] || {}
      if (!items[name].pos) {
        items[name].pos = self.attr(`data-${block}-pos`) || this.getBBox().y
      }
      if (!items[name].color) {
        items[name].color = self.attr(`data-${block}-color`) ? self.attr(`data-${block}-color`) : self.style('fill') !== 'none' ? self.style('fill') : self.style('stroke')
      }
    })

    const item = li
      .selectAll(`.${block}__item`)
      .data(d3.entries(items).sort((a, b) => a.value.pos - b.value.pos))
      .enter()
      .append('g')
      .classed(`${block}__item`, true)
      .style('transform', (d, i) => `translateY(${i + i * 0.25}em)`);

    item
      .append('text')
      .attr({ y: 0, x: '1em' })
      .text((d) => d.key)

    item
      .append('circle')
      .attr({
        cy: `${-0.25}em`,
        cx: 0,
        r: '0.4em',
      })
      .style('fill', (d) => d.value.color)

    // Reposition and resize the box
    const lbbox = li[0][0].getBBox()
    lb.attr({
      x: lbbox.x - legendPadding,
      y: lbbox.y - legendPadding,
      height: lbbox.height + 2 * legendPadding,
      width: lbbox.width + 2 * legendPadding,
    })
  })

  return g
}

d3.box = (options = {}) => {
  options = to.extend({
    data() {
      let items = {}

      this.selectAll(`[data-${block}]`).each(function() {
        const self = d3.select(this)
        const name = self.attr(`data-${block}`)
        items[name] = items[name] || {}
        if (!items[name].pos) {
          items[name].pos = self.attr(`data-${block}-pos`) || this.getBBox().y
        }
        if (!items[name].color) {
          items[name].color = self.attr(`data-${block}-color`) ? self.attr(`data-${block}-color`) : self.style('fill') !== 'none' ? self.style('fill') : self.style('stroke')
        }
      })

      return d3.entries(items).sort((a, b) => a.value.pos - b.value.pos)
    },
    callback() {
      this
        .append('text')
        .text((d) => d.key)
    },
    class: undefined,
    box_padding: 5,
    item_margin: 0.25,
  }, options)

  return (g) => {
    g.each(function() {
      const g = d3.select(this)
      let svg = d3.select(g.property('nearestViewportElement'))
      let block = options.class || g.attr('data-name') || g.attr('class').split(' ')[0] || 'box'
      let lb = g.selectAll(`.${block}__box`).data([ true ])
      let li = g.selectAll(`.${block}__items`).data([ true ])

      lb.enter().append('rect').classed(`${block}__box`, true)
      li.enter().append('g').classed(`${block}__items`, true)
      li.selectAll(`.${block}__item`).remove() // remove existing items

      li
        .selectAll(`.${block}__item`)
        .data(options.data(svg))
        .enter()
        .append('g')
        .classed(`${block}__item`, true)
        .style('transform', (d, i) => `translateY(${i + i * 0.25}em)`)
        .each(function(item) {
          options.callback(d3.select(this))
        })

      // Reposition and resize the box
      const lbbox = li[0][0].getBBox()
      lb.attr({
        x: lbbox.x - options.box_padding,
        y: lbbox.y - options.box_padding,
        height: lbbox.height + 2 * options.box_padding,
        width: lbbox.width + 2 * options.box_padding,
      })
    })

    return g
  }
}


window.d3 = d3

import to from 'to-js'
import generateCssData from './generateCssData'

class SpecificityGraph {
  constructor(options) {
    this.specificity_data = []
    this.x = undefined
    this.y = undefined
    this.index = 0
    this.data = []

    this.options = to.extend({
      width: (svg) => svg ? svg.width.animVal.value : 1000,
      height: (svg) => svg ? svg.height.animVal.value : 400,
      average: false,
      important: false,
      padding: {
        top: 40,
        right: 60,
        bottom: 40,
        left: 60
      },
      dots: false,
      fill: false, // close the path or use a line
      selector: '.js-graph',
      hoverText(elem) {
        elem
          .append('text')
          .text(({ id, selectors, specificity}) => `${id}(${specificity}): ${selectors}`)
      },
      ticks: false,
      x_name: 'selectorIndex', // selectorIndex, line
      y_name: 'specificity', // specificity
      // linear, step-before, step-after, basis, basis-open, basis-closed,
      // bundle, cardinal, cardinal-open, cardinal-closed, monotone
      linetype: 'monotone',
      order: 'x', // x or y
    }, options)

    this.init()
  }

  get line() {
    const { average: avg, x_name, y_name, linetype } = this.options
    const line = d3.svg.line()
      .x((d, idx) => this.x(d[x_name]))
      .y((d) => this.y(d[y_name]))

    if (!avg) {
      return line.interpolate(linetype)
    }

    let n = avg

    if (
      typeof n === 'boolean' ||
      typeof number !== 'number'
    ) {
      const length = this.data.reduce((a, b) => a > b.data.length ? a : b.data.length, 0)
      n = length / ((this.width - this.padding.left - this.padding.right) / 8)
    }

    return line.interpolate(average(n, linetype))
  }

  init() {
    const { ticks, x_name, selector } = this.options
    const transform = `translate(-${window.innerHeight || 5000}, -${window.innerWidth || 5000})`
    this.svg = d3.select(selector)

    this.svg.classed('has-ticks', ticks)

    this.elements = {}


    this.elements.legend = this.svg.append('g')
      .attr({ class: 'legend', transform })

    // holds the graphs current paths
    this.elements.paths = {}

    // x axis
    this.elements.x_axis = this.svg.append('g')
      .attr({ class: 'axis axis--x', transform })

    // x domain label
    this.elements.x_label = this.svg.append('text')
      .attr({
        class: 'domain-label domain-label--x',
        'text-anchor': 'middle',
        transform
      })
      .text('Location in stylesheet')

    // y axis
    this.elements.y_axis = this.svg.append('g')
      .attr({
        class: 'axis axis--y',
        transform
      })

    // y domain label
    this.elements.y_label = this.svg.append('text')
      .attr({
        class: 'domain-label domain-label--y',
        'text-anchor': 'middle',
        transform
      })
      .text('Specificity')

    this.elements.groups = this.svg.append('g')
      .attr({
        class: 'groups',
        transform
      })

    // handle on mouseover info indicator and info text
    this.elements.info = this.svg.append('g')
      .attr('class', 'info')
      .style('display', 'none')

    // this handles the creation of the information box
    this.box = d3.box({
      data: () => this.current,
      callback: (elem) => this.options.hoverText(elem)
    })

    this.elements.indicators = this.svg.append('g')
      .attr('class', 'indicators')
      .style('display', 'none')

    this.elements.indicator = this.svg.append('circle')
      .attr({
        class: 'indicator',
        r: 4.5
      })
      .style('display', 'none')

    this.elements.overlay = this.svg.append('rect')
      .attr('class', 'overlay')
      .style({ height: 0, width: 0, })

    this.elements.overlay
      .on('mouseout', () => {
        this.elements.info.style('display', 'none')
        this.elements.indicator.style('display', 'none')
        this.elements.indicators.style('display', 'none')
      })
      .on('mouseover', () => {
        this.elements.info.moveToFront()
        this.elements.indicator.moveToFront()
        this.elements.indicators.moveToFront()
      })
      .on('mousemove', () => {
        if (this.x) {
          const xpoint = this.x.invert(d3.mouse(this.elements.overlay.node())[0])
          const a = d3.bisector((d) => d[x_name]).left(this._data, xpoint, 1)
          const b = a - 1
          const d0 = this._data[b]
          const d1 = this._data[a]
          let index

          // check which value we're closer to (if within bounds)
          if (typeof d0 === 'undefined') {
            if (typeof d1 === 'undefined') return
            index = a
          } else if (typeof d1 === 'undefined') {
            index = b
          } else {
            index = (xpoint - d0[x_name]) > (d1[x_name] - xpoint) ? a : b
          }

          this.updateInfo(index)
        }
      })
  }

  renderChart() {
    this.updateScale()
    const { width, height, padding } = this
    const { ticks, order } = this.options

    this.elements.x_axis
      .call(this.xAxis)
      .attr('transform', `translate(0, ${height - padding.bottom})`)

    // x domain label
    this.elements.x_label
      .attr({
        transform: `translate(${width / 2}, ${height - padding.bottom})`,
        y: ticks ? '3em' : '2em'
      })

    // y axis
    this.elements.y_axis
      .call(this.yAxis)
      .attr('transform', `translate(${padding.left}, 0)`)

    // y domain label
    this.elements.y_label
      .attr({
        transform: `translate(${padding.left}, ${height / 2}) rotate(-90)`,
        y: ticks ? '-2em' : '-1em'
      })

    this.elements.overlay
      .attr('transform', `translate(${padding.left}, ${padding.top})`)
      .style({
        width: width - padding.left - padding.right,
        height: height - padding.top - padding.bottom,
      })

    this.elements.groups
      .attr('transform', null)

    // window.d3 = d3
    this.elements.legend
      .call(d3.legend)
      .attr('transform', `translate(${width - padding.right - this.size(this.elements.legend).width}, ${padding.top})`)

    this.elements.info
      .attr('transform', `translate(${padding.left + 10}, ${padding.top})`)
  }

  size(elem) {
    return elem.node().getBBox()
  }

  order() {
    const order = this.options.order
    // sort the data by the mean
    this.data = this.data.sort((a, b) => a.mean[order] < b.mean[order])

    // update the position of each group to match the mean order
    this.data.forEach((data) => data.group.moveToFront())
  }

  updateDimensions() {
    const run = (arg) => {
      if (to.type(arg) === 'object') {
        let result = {}
        for (let key in arg) {
          if (arg.hasOwnProperty(key)) {
            result[key] = typeof arg[key] === 'function' ? arg[key](this.svg.node()) : arg[key]
          }
        }
        return result
      }

      return typeof arg === 'function' ? arg(this.svg.node()) : arg
    }

    this.font_size = parseInt(window.getComputedStyle(this.svg.node(), null).getPropertyValue('font-size'))
    this.height = run(this.options.height)
    this.width = run(this.options.width)
    this.padding = run(this.options.padding)

    if (this.options.ticks) {
      this.padding.bottom += this.font_size
    }

  }

  generateData(str) {
    let data = generateCssData(str, this.options.important)

    if (!this.options.fill) {
      return data.slice(1, -1)
    }

    return data
  }

  updateScale() {
    this.updateDimensions()
    const { ticks, x_name, y_name } = this.options
    const { height, width, padding } = this
    this.x = d3.scale.linear()
      .range([ padding.left, width - padding.right ])
      .domain(d3.extent(this._data, (d) => d[x_name])) // gets the min and max values
      .nice()

    this.y = d3.scale.linear()
      // shit
      // .range([ height - padding.top, padding.bottom ])
      .range([ height - padding.bottom, padding.top ])
      .domain([ 0, to.clamp(d3.max(this._data, (d) => d[y_name]), 0, 100) ])
      .nice()

    this.xAxis = d3.svg.axis()
      .scale(this.x)
      .tickSize(0)
      .tickPadding(ticks ? 10 : 0)
      .orient('bottom')

    this.yAxis = d3.svg.axis()
      .scale(this.y)
      .tickSize(0)
      .tickPadding(ticks ? 10 : 0)
      .orient('left')

    // updates the x axis
    this.elements.x_axis
      .call(this.xAxis)
      .selectAll('text')

    // updates the y axis
    this.elements.y_axis
      .call(this.yAxis)
      .selectAll('text')
  }

  exists(selector) {
    return !!this.svg.select(selector).node()
  }

  flattenData() {
    const { x_name, y_name } = this.options
    this._data = []
    this.data.forEach(({ id, data }) => {
      for (let i = 0; i < data.length; i++) {
        this._data.push({ id, ...data[i] })
      }
    })

    this._data = this._data.sort((a, b) => a[x_name] < b[x_name] ? -1 : a[x_name] > b[x_name] ? 1 : 0)
  }

  add(id, data) {
    if (to.type(data) === 'object') {
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          this.add(data[key], key)
        }
      }
      return
    }

    const { x_name, y_name } = this.options

    // prevent this function from adding the same data item
    if (this.exists(`.group--${id}`)) {
      return
    }

    if (to.type(data) === 'string') {
      data = this.generateData(data)
    }

    id = id || this.data.length

    const mean = {
      x: d3.mean(data, (d) => d[x_name]),
      y: d3.mean(data, (d) => d[y_name]),
    }

    const group = this.elements.groups.append('g')
      .attr({
        class: `group group--${id}`,
        'data-mean-x': mean.x,
        'data-mean-y': mean.y,
      })

    const line = group
      .append('path')
      .attr({
        class: 'line-path',
        'data-legend': id,
      })

    const dots = group
      .append('g')
      .attr('class', 'dots')

    this.data.push({ id, data, group, line, dots, mean })

    this.flattenData()
    this.renderChart()

    const fakeData = this.fakeData(data)
    // draw the fake line
    line
      .attr('d', this.line(fakeData))

    // draws the dots
    dots.selectAll('.dots__dot')
      .data(fakeData)
      .enter()
      .append('circle')
      .classed('dots__dot', true)
      .attr({
        'stroke-miterlimit': 10,
        r: 0,
        cx: (d) => this.x(d[x_name]),
        cy: (d) => this.y(d[y_name]),
      })

    return this
  }

  toggle(id, data) {
    if (this.exists(`.group--${id}`)) {
      return this.remove(id)
    }

    return this.add(id, data)
  }

  remove(id) {
    this.data = this.data.filter((d) => d.id !== id)
    this.flattenData()
    this.elements.groups.selectAll(`.group--${id}`).remove()
    this.elements.legend.selectAll('.legend__item').remove()
    this.updateScale()
    this.renderChart()
  }

  draw(duration = 500, ease = 'elastic') {
    const { x_name, y_name } = this.options

    for (let { id, data, group, line, dots } of this.data) {
      line
        .transition()
        .duration(duration)
        .attr('d', this.line(data)) // draws the line

      if (this.options.dots) {
        // draws the dots
        dots.selectAll('.dots__dot')
          .data(data)
          .transition()
          .duration(duration)
          .each('start', function() {
            d3.select(this).attr('r', '1.5')
          })
          .delay((d, i) => {
            const offset = d[x_name] * 0.8 + d[y_name] * (data.length * 4)
            return parseFloat(offset / duration).toFixed(2)
          })
          .ease(ease)  // 'circle', 'elastic', 'bounce', 'linear'
          .attr({
            cx: (d) => this.x(d[x_name]),
            cy: (d) => this.y(d[y_name]),
          })

        // select the first dot in the set add add a data-legend. The reason every point
        // doesn't have a `data-legend` on it is because it would try to add a legend item
        // for every single point which is entirely to many
        dots
          .select('.dots__dot')
          .attr('data-legend', id)
      }
    }

    this.order()
  }

  fakeData(data, modifier = 2) {
    const y_name = this.options.y_name
    return data.map((item) => {
      item = to.clone(item)
      item[y_name] = !modifier ? 0 : item[y_name] / modifier
      return item
    })
  }

  nextInfo() {
    this.updateInfo(this.index + 1)
  }

  prevInfo() {
    this.updateInfo(this.index - 1)
  }

  updateInfo(index) {
    const { x_name, y_name } = this.options
    const { padding, width: w } = this
    const data = this._data
    this.index = index = to.clamp(index || this.index, 0, data.length - 1)
    this.current = data.filter((d) => d[x_name] === index).sort((a, b) => a.id.localeCompare(b.id))
    if (this.current.length) {
      this.elements.info
        .style('display', null)
        .call(this.box)

      this.elements.indicators
        .style('display', null)
        .selectAll('.indicators__point')
        .remove()

      this.elements.indicators
        .selectAll('.indicators__point')
        .data(this.current)
        .enter()
        .append('circle')
        .attr({
          class: (d) => `indicators__point indicators__point--${d.id}`,
          r: 4.5,
          transform: (d) => `translate(${this.x(d[x_name])}, ${this.y(d[y_name])})`
        })
    }
  }
}

function average(n, linetype = 'basis') {
  return (points) => {
    const first = points.shift()
    const last = points.pop()
    const initial_length = points.length
    let result = []
    for (let i = 0; i < points.length; i++) {
      let to = i + n - 1
      if (to < points.length) {
        result.push(
          points
            .slice(i, to + 1)
            .reduce((a, b) => [ a[0] + b[0], a[1] + b[1] ])
            .map((each) => each / n)
        )
      }
    }

    result.unshift(first)
    result.push(last)

    return d3.svg.line().interpolate(linetype)(result).slice(1)
  }
}

SpecificityGraph.average = average

module.exports = SpecificityGraph