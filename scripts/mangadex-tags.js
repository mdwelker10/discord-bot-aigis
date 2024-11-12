(async () => {
  const data = await fetch('https://api.mangadex.org/manga/tag')
  let json = await data.json()
  let m = {};
  for (let i of json.data) {
    m[i.attributes.name.en] = i.id;
  }
  console.log(m)
})();