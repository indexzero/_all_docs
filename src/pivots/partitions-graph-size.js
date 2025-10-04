const d3 = require('d3');
const { D3Node } = require('d3-node');

const fs = require('fs');

const { join } = require('node:path');
const { readPartitions } = require('@_all_docs/cache');

const partitions = require(process.env.PARTITIONS);
const cacheDir = join(__dirname, '..', 'cache');

function generateBarChart(data, outputFile = 'chart.svg') {
  const width = 1000;
  const barHeight = 4;
  const margin = { top: 20, right: 30, bottom: 50, left: 80 };
  const height = Math.min(100000, data.length * barHeight + margin.top + margin.bottom);

  const d3n = new D3Node();
  const svg = d3n.createSVG(width + margin.left + margin.right, height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([0, width]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, height - margin.bottom])
    .padding(0.1);

  svg.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("y", d => y(d.label))
    .attr("height", y.bandwidth())
    .attr("x", 0)
    .attr("width", d => x(d.value))
    .attr("fill", "steelblue");

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5));

  fs.writeFileSync(outputFile, d3n.svgString());
}

(async function () {
  const partitions = await readPartitions(cacheDir);

  const formattedData = partitions.map(({ id, _all_docs }) => {
    return {
      label: id,
      value: _all_docs.rows.length
    };
  });

  await generateBarChart(formattedData);
  console.log('SVG chart saved as chart.svg');
})();
