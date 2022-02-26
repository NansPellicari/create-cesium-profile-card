# Create a PDF from public key for Césium

## requirements

- [pnpm](https://pnpm.js.org/)

## install

```bash
pnpm i
```

## create profiles

(with my public key)

```bash
pnpm start 4FHhfYtv5bdjKrqmXvTdWLPpgiXALm7ZKAcw2iavSTGn
```

or you can create a `.profiles` file and create a new line for each a public key, then launch:

```bash
pnpm start file
```
or if you want all in on file
```bash
pnpm start file c
```

or if you want to force the user name doisplayed

```bash
pnpm start MyUserName:4FHhfYtv5bdjKrqmXvTdWLPpgiXALm7ZKAcw2iavSTGn
```
