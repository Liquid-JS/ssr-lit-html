import { html, render } from './ssr-lit-html'

render(html`
<!doctype HTML>
<html>

<head>
    <base href="sdfsdf">
</head>

<body>
    ${'asdfasd'}
    ${[1, 2, 3].map(i => html`<span>${i}</span>`)}
</body>

</html>
`).then(console.log)
