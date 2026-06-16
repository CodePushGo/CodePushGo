const websiteOrigin = 'https://codepushgo-website.pages.dev'

function toWebsiteRegister(request: Request) {
  const incoming = new URL(request.url)
  const target = new URL('/register/' + incoming.search, websiteOrigin)
  return new Request(target, request)
}

export default {
  async fetch(request: Request) {
    return fetch(toWebsiteRegister(request))
  },
}
