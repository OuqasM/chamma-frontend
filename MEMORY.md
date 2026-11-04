# MEMORY

Project: **Chamma** — perfume e-commerce, Laravel API backend + React/Vite frontend.
Last updated: 2026-11-04.

> This is the project's whole memory, not the frontend's alone: it records what was done on
> both sides and, more usefully, why. It lives in this repository because the workspace root
> is not a repository — `frontend/` and `backend/` are two independent repos and the root
> holds only files that belong to neither (the deploy script, `docker-compose.yml`, this
> file). The pointer at the root says where it went.

## Latest session (2026-11-04) — the customers, the delivered orders, and the containers serving four-week-old code

The owner: *"AdminPanel orders should be created by 'delivered'"*, *"the form should contains (in
order) a phone number (auto complete with from a new cutomer entity(id,name,phone,city,adress))"*,
*"if i select a phone number from the autocomplete dropdown it should automaticaly fill the name
input and adress city"*, *"delevery fees shoul be filled also from the city"*, *"if not we should
create a new customer"*, *"each operation with phone should be after we normaliz the phone
number"*, *"all numbers are moroccan start with 06/07 or 212"* and *"i should also select
products"*.

Then, after seeing none of it: *"you arent saving customer data for future orders and i cant see
customers handling"* and *"also orders ar not created as delivered!!"*.

One request with three parts to it — a customer the shop can recognise, a form that starts from
the phone number, and an order that lands as delivered — and a second one that turned out to be
about the containers, not the code.

### A customer is a row with a number on it

- **`customers` table** (`2026_11_04_090000_create_customers_table.php`): `id`, `name`, `phone`,
  `phone_normalised`, `city`, `address`. **The number is the identity** — `phone_normalised` is
  unique, which is what stops one person from being three customers because they wrote their
  number three ways.
- **`CustomerService`** is the only thing that touches a number: `findByPhone()`,
  `searchByPhone()` (a **prefix**, because a number is typed from the left) and `record()`.
  `record()` catches `UniqueConstraintViolationException` and retries as the update it was — the
  same race the waiting list handles.
- **A customer is written by an order, never by hand.** There is no "add a customer" button: a
  row nobody ordered from is not a customer, it is a guess. `OrderService::place()` records it
  **inside the order's transaction**, so a refused order (sold out) leaves no orphan behind — and
  a checkout order records one too, so the panel finds website customers as well.
- The **last order wins** on the name, the city and the address: a customer who moved is at their
  new address now.
- **`GET /api/admin/customers?phone=…`** is a read and nothing else. It answers the panel's
  autocomplete.

### Every operation on a number starts by reducing it

- `PhoneNumber::normalise()` gained a sibling, **`PhoneNumber::nationalDigits()`**: the national
  digits of a *partial* number ("612" for "0612"), because the panel searches while the owner is
  still typing. `normalise()` is built on it and still decides whether a number is complete.
- **The leading zero is now optional** — "612345678" is the same handset as "0612345678", and a
  number read off a card often arrives without it. It used to be rejected outright.
- The browser has its own copy in **`frontend/src/lib/phone.js`** (`nationalDigits`,
  `normalisePhone`). The panel reduces the number **before** it looks anything up and **before**
  it sends it; the server reduces it again, and the server is the one that decides.
- The **admin order's phone is stored reduced** ("+212612345678"). The storefront's is not — it
  keeps what the customer typed, as it always has.

### Two decisions reversed, with the reasons

1. **The admin phone is no longer a free string.** `Admin\StoreOrderRequest` used to accept thirty
   characters of anything, because the owner is transcribing what someone said on the phone and
   second-guessing it would fail a deliverable order. That was right while the number was only a
   thing to call back on. It is not right now: **the number is how a customer is found again**, and
   a number that cannot be reduced would file an order under a customer nobody will ever find. It
   is reduced in `prepareForValidation()` and then held to `MoroccanPhone`.
2. **A search that only understood one shape of a number would have found nothing.** The panel's
   orders carry the reduced number, so the **admin orders list** now also matches the spoken
   form ("0612345678", or even "0612"), and so does the **storefront's order lookup** — a customer
   given a reference types their own number, not the shape this shop happens to write it in.

### The order is created as delivered

- `OrderService::place()` takes the status it creates the order with; the checkout path still
  starts at `new`, the panel's path starts at **`delivered`**. The owner is recording a
  conversation they just had — the customer called, the parcel went out, the money changed hands —
  and an order that landed as "new" would sit in the list waiting for somebody to remember to
  move it along.
- **Delivered means collected**, so the payment is `paid` by default and the owner unticks it for
  a transfer that has not arrived yet. The old "mark as paid" checkbox became "payment collected",
  checked.
- **A delivered order is closed**, so it cannot be moved afterwards — the same rule that already
  applied to an order advanced to delivered. Worth saying plainly: a typo in a panel order can no
  longer be corrected by changing its status.

### The form starts from the number

- The **phone is the first field**, and it is an autocomplete: typing it searches the customers,
  and choosing one fills in the **name, the address and the city**.
- **The delivery fee follows the city** — the carrier's own figure for that city, shown under the
  city field, in the city list, and in the totals **before any product is picked**. What a parcel
  costs to deliver does not depend on what is inside it. The server's quote takes over once there
  are products, because the free-delivery threshold can then make it cost nothing.
- **A number nobody knows is not an error**: the panel says it is a new customer, and the order
  creates them.
- The number is reduced **when the field is left**, not on every keystroke — rewriting the field
  under the caret while somebody is still typing it is how a number ends up mangled.

### The panel was never running this code

- **The docker images bake the code in** (`COPY . .`), and only `public/images` and
  the app-key are mounted. A container built four weeks ago keeps serving the
  code of four weeks ago, whatever is on disk. The owner was testing the old
  build: no delivered orders, no customers, and a 404 on the customer
  endpoint.
- **The backend and the frontend both have to be rebuilt** — `docker compose build
  backend frontend && docker compose up -d` — and the entrypoint runs `migrate
  --force` on boot, so the schema follows the code.
- **The `dist/` in the repository is not what the container serves.** The
  frontend image runs `npm run build` inside Docker, so its bundle hash differs
  from the one committed locally. The committed `dist` is what the *shared
  hosting* deploy publishes (`deploy_chamma.sh`), the image is what the local
  stack serves. Two bundles, two purposes.

### The customers screen — "i cant see customers handling"

- **`/admin/customers`** (list) and **`/admin/customers/:id`** (one customer and
  their orders), plus a nav entry.
- The list says the two things that decide how to treat a person: **how many
  times they have ordered** and **when they last did**, and it is searchable
  by name or by number.
- **`GET /api/admin/customers`** is the list, **`/search`** is the autocomplete
  the order form uses, **`/{customer}`** is the detail. The search route is
  registered before the parameter route so it is not swallowed by it.
- **The orders the shop already had became customers.** They were sales, but
  there was no record of *who* they were sold to — so the customer list would
  have started empty while the order list was full, which reads as "we have no
  customers" and is wrong. `2026_11_04_110000_backfill_customers_from_orders`
  turns every existing order into its customer.
- **A customer's orders are joined on the reduced number**, not the typed one:
  a website order keeps what the customer typed, an order typed in the panel
  keeps the reduced form, and they would not join otherwise. That is what
  `2026_11_04_100000_add_phone_normalised_to_orders_table` adds — and it
  **backfills the existing rows**, so the orders that predate the column are
  still their customer's.
- **The backfilled city is the carrier's spelling** ("RABAT", not "Rabat"), and
  that matters: the panel's city list holds the carrier's spelling, so a
  customer whose city is not in that list cannot be prefilled into the form and
  the save would be refused for a field the owner cannot see. The panel also
  refuses to prefill a city the shop no longer delivers to, rather than
  putting an invisible value in the field.

### The panel's order form, end to end

- The **phone is the first field** and it is an autocomplete; choosing a
  customer fills in the **name, the address and the city**, and the delivery
  fee follows the city.
- **The order is created as `delivered`, and `paid`.** Verified against the
  running stack, not only in the tests.
- **A number nobody knows is a new customer**, created with the order.

### The phone field is an autocomplete that starts full

- *"the phone input is not auto complete, it should also be pre-fillded with some rows and after the user enter a keyword you should filter the dropdown, if the user select nothing, a new customer should be created"*.
- **The rows are loaded as soon as the form opens** — the customers the shop saw most recently — so clicking into the field brings them up at once rather than after a wait. A list that says "type to search" says nothing, and the owner is usually recording an order for somebody they have dealt with before. `GET /api/admin/customers/search` with no term answers with them.
- **But the dropdown is closed until the owner is in the field.** It was open by default at first, and that was wrong: a list covering the form before anybody has touched anything is in the way, not a help. The rows are *loaded* by default; the list is not *shown*.
- **Typing filters the rows.** The term is a **keyword**: a number typed as it is spoken **or a name**. `CustomerService::search()` does both, and the **exact number comes first** when the term is a whole one: it is the one the owner meant.
- **A number is searched as a fragment, not only as a prefix.** *"you should search for phones with a part of it not only the start of it"*. The owner remembers "45678" or the middle of a number more often than the whole thing, and the middle is the part they are surest of. `PhoneNumber::searchDigits()` returns the digit strings a term could mean — the digits as typed, the digits with the country code taken off, and the digits with the leading zero taken off — and all of them are looked for. Two digits are too few ("61" would match most of the shop's customers); three is the floor.
- **The server reduces the number**, not the panel: it is the one place that decides what a number is, and the panel does not second-guess it. The panel sends the term as typed.
- **The list closes when the owner clicks away but the rows stay loaded**, so coming back to the field brings them straight back — clearing them would have meant the field could only be re-opened by typing.
- **Selecting nothing is a decision, not a failure.** A number the shop does not know is announced as a new customer, and the order creates them.
- **A row shows the number and the city, nothing else** — *"show only phone and
  city"*. The number is how the owner recognises the person, and the city is
  what decides the delivery fee. The name arrives *with* the customer when the
  row is chosen.

### Every phone is ten characters

- *"all customers's number should start with 06/07 you should replace 212 or +212.. all phones
  should be 10 characters"*.
- **The canonical form is now the national one: "0612345678".** It used to be
  "+212612345678". The country code is not part of how a Moroccan number is
  written, and it is not what the owner dials to reach somebody in the next
  town.
- `PhoneNumber::normalise()` returns the ten-character form;
  `PhoneNumber::whatsappDigits()` rebuilds the international digits for wa.me
  ("212612345678"), because wa.me wants the country code and no national
  leading zero. **The link did not change** — only the form it is built from.
- **Every number the shop stores is that form**: the customers, the orders and
  the waiting list. `2026_11_04_120000_put_every_phone_in_the_national_form`
  rewrites the rows that carried the country code.
- **The rewrite had to happen, not just the new writes.** The unique indexes
  are on the reduced column, so a number stored one way and looked up another
  would have stopped matching itself: the waiting list would have grown a
  second entry for a customer who signed up twice, and a customer's orders
  would have come apart.
- **The waiting list's `phone` column now holds the canonical form too**,
  reversing the older decision that it kept what the customer typed. One form
  everywhere is worth more than the memory of how it was typed.
- **05 landlines still work**: the number is written "0512345678", ten
  characters as well. The `MoroccanPhone` rule has always accepted the 05
  range, because some customers order on one.

### The delivery fee follows the city, and the owner decides

- *"i should have rectify order's delevery fees from the order form (it should be updated for
  that city) i should have also possibility to free delevery"*.
- **The fee field starts at the carrier's price for the city** and is rewritten when the city
  changes — what a parcel costs to deliver is a fact about where it is going, and the old figure
  belonged to the old city.
- **The owner can change it, and make it free.** A negotiated rate, a free delivery for a regular,
  a free delivery to make up for a late one. There is a "free delivery" switch that puts the fee
  at zero.
- **Only the owner's figure is sent.** When they have not touched the fee, the panel sends
  nothing and the **server** decides — the carrier's price *and* the free-delivery threshold,
  which the panel's own quote already reflects. Sending the city's price from the browser would
  have quietly overridden the threshold: an order over it would have been charged delivery.
- `OrderService::place()` takes the fee as an argument; the **checkout path never passes one**,
  so the shopper cannot price their own delivery. There is a test for that.
- **The bound is 1000 dirhams**, so a mistyped figure cannot turn a 35-dirham delivery into a
  35 000-dirham one.
- **The totals add up to what will be stored**: the server's subtotal plus the fee that will
  really be charged.

### The delivery fee is kept for the city

- *"if i changed delevery fees for a city it should be persisted for that city"*.
- **The figure the owner puts in the order form is kept for that city** and is what every later
  order to it is billed at — the storefront included, because a shopper told 35 and charged 50 has
  been told two different things.
- The overrides live in the **settings table** (`shipping_fee.CASABLANCA`), not in a table of their
  own: there are a handful of them, they are read on the checkout path, and the settings are
  already cached and already forgotten on a write.
- **A free delivery for one order is not a decision about the city.** The panel sends
  `remember_fee`, and the "free delivery" switch says no: it prices that order, not every order
  that follows.
- **There is a way back**: `DELETE /api/admin/shipping/fees/{city}` puts the carrier's price
  back, and the panel offers it whenever the city is priced for itself. Without it, a city priced
  free for one order would stay free for every order after it.

### The benefit, and the figures over a window

- *"also return their total sales, and the benifit turnover - capital"* and *"the benefit of each
  order is its total - (purshase price of each of its products) (purshase price for each product
  should be required"*.
- **The benefit of an order is its total minus what the goods cost** — the purchase price of each
  of its products.
- **The purchase price is snapshotted on the order line**, like the selling price: the benefit of
  an order is the benefit it had when it was placed, and not one that changes every time a product
  is repriced.
- **The purchase price is required on every product** — the admin API asks for it, and the column
  is NOT NULL. A product created another way (a script, a seeder, a test) gets **its selling price**
  as its purchase price: a zero margin, which understates the benefit rather than inventing one.
  The products list shows the purchase price, so the ones nobody has filled in yet are visible.
- **The orders list returns the figures over the filtered set**, not over the page on screen:
  `total_sales`, `total_cost`, `total_benefit` and the number of orders. The owner is asking what
  the shop took and what it earned; a page of twenty would answer a different question.
- **The orders can be filtered by a window of dates** (`start_date`, `end_date`). A date on its own
  means the whole of that day — "from the 1st" is the 1st, not midnight on the 1st with every
  order of the morning missing.
- **A migration's order matters**: the products' purchase-price backfill has to run **before** the
  order lines' backfill, or the lines copy a purchase price that is still null and every order
  reads as a benefit of its whole turnover. The two were renumbered when it was found — a
  migration that has been applied must not be edited, so the local database was brought back to
  the state before them and re-run.

### The benefit is settled when the sale happens

- *"benefice should be while creating the order for admin created orders and while movine client
  passed order to delivered so the user can rectify the benefis"*.
- **The cost of an order is settled when the sale happens**: an order the owner writes in the panel
  is delivered from the start, so it is settled when it is created; a **website order is settled
  when it is moved to delivered**. Until then its benefit is **null** — the panel shows a dash and
  the summary does not count it. An order still in flight has no benefit yet, and saying so is
  truer than counting a figure that may still change.
- **The owner rectifies a purchase price, and the benefit follows**: correcting a product's purchase
  price re-reads it onto the delivered orders that contain it. The owner corrects prices from
  memory, from a supplier's invoice, long after the sale — and the figure they read on the order
  has to follow the correction.
- The summary counts the **sales over every order in the filter** (what the shop took) and the
  **benefit over the delivered ones** (what it earned), and says which is which.

### Two buttons the owner asked for

- *"admin can have a btn to mark that product as 'out of stock'"* — it was in the row's action
  menu, two clicks deep. It is a button on the row now: it is the thing the owner does most often
  when a bottle sells out, and burying it is what makes a shop keep selling what it does not have.
- *"(for variats) remove variant"* — the size chip in the product form carried a bare `×`, which
  reads as a decoration. It is a button with a word on it, because removing a size is a decision
  (a discontinued 100 ml), not a typo to undo.

### …and where the owner actually wanted them

- *"where is can set a product as out of stock of remove variant in order form of when passing an
  order to delivered???"* — **in the order form and on the order being handed over**, not in the
  products list. The decision is made while the parcel is going out: the bottle has just sold out,
  or the size is discontinued for good. Both are now in the order form's lines and in the order
  detail's lines, through one shared component (`components/admin/ProductActions.jsx`).
- **Marking out of stock now sets the state** rather than flipping it: `PATCH
  /admin/products/{id}/availability` takes `{ available: false }`. The button means one thing and
  says it the same way twice; the products list's button, which says which way it will go, still
  flips.
- **Removing a size is `DELETE /admin/products/{product}/variants/{name}`** — the size is *named*,
  not numbered: an order remembers the name it was sold under, not the row it came from, and the
  name is unique within the product.
- **Neither touches the order.** The line keeps the name it was written with, which is what the
  history means.

### Tests

- New: `backend/tests/Feature/AdminProductStockActionsTest.php` (5),
  `backend/tests/Feature/AdminSalesFiguresTest.php` (12),
  `frontend/src/pages/admin/Orders.figures.test.jsx` (3),
  `frontend/src/pages/admin/Products.stock.test.jsx` (2) and
  `frontend/src/components/admin/ProductActions.test.jsx` (3). Suite now **373 backend / 1647
  assertions**, **167 frontend** (was 164).
- **A space in a path is `%20`, not `+`.** `urlencode()` writes it as `+`, which in a path is a
  literal plus — so "100 ml" arrived as "100+ml" and the size was not found.
- The frontend mocks of `useAdmin` now return a **stable `call`**. A fresh one on every render
  restarted the customer lookup's debounce on every render, and the search never finished — the
  test was waiting for an answer the mock had cancelled.
- The frontend test's `type` helper **focuses the field first**, because nobody types into a
  field they have not clicked into — and the panel only shows the list when the owner is in it.
- **A checkbox is toggled by the click alone.** Setting `checked` by hand and then dispatching a
  click toggles it *back* — jsdom runs the activation behaviour — so the switch never turned on.
- **A form with a disabled default button does not submit**, so `requestSubmit()` silently did
  nothing while the save button was disabled for want of a product.
- `frontend/dist` is committed and is what the deploy publishes, so the bundle was rebuilt.

### The order, the payment and the closed book

- **The order is created as `delivered`** — `OrderService::place()` takes the status it creates the
  order with; the checkout path still starts at `new`, the panel's path starts at `delivered`. The
  owner is recording a conversation they just had: the customer called, the parcel went out, the
  money changed hands. An order that landed as "new" would sit in the list waiting for somebody to
  remember to move it along.
- **Delivered means collected**, so the payment is `paid` by default and the owner unticks it for
  a transfer that has not arrived yet. The old "mark as paid" checkbox became "payment collected",
  checked.
- **A delivered order is closed**, so it cannot be moved afterwards — the same rule that already
  applied to an order advanced to delivered. Worth saying plainly: a typo in a panel order can no
  longer be corrected by changing its status.
- **The delivery fee follows the city** — the carrier's own figure for that city, shown under the
  city field, in the city list, and in the totals *before any product is picked*. What a parcel
  costs to deliver does not depend on what is inside it. The server's quote takes over once there
  are products, because the free-delivery threshold can then make it cost nothing.
- The number is reduced **when the field is left**, not on every keystroke — rewriting the field
  under the caret while somebody is still typing it is how a number ends up mangled.

## Previous session (2026-11-03) — the admin panel's articles column, its pages, and the colour of a sold-out photo

The owner: *"Articles column's text on adminPanel shows outside its border"*, *"when
pagination to another page the browser should start from the top not keeping the user on the
buttom"* and *"unvalaibale products's images on the client side should be colored"*. Two things
in the panel, and one on the storefront.

### The articles column painted over its neighbour

- The column is capped (`max-w-72` — 288px) and the line inside it was `whitespace-nowrap`:
  a name truncated at `max-w-48`, a variant and a quantity that were not truncated at all.
  The line was 349px of content in a 288px cell, so **61px of it painted over the cell's own
  border and landed on the city beside it** — the text read as if it belonged to the next
  column. Measured in Chrome against the built CSS: `scrollWidth` 349, `clientWidth` 288, the
  text's right edge 61px past the cell's border.
- The line is a flex row now, and each part is told what to do when the cell runs out of room:
  the **name** gives way (`min-w-0 truncate`, the whole name on `title`), the **variant**
  truncates at 6rem (`max-w-24 shrink-0 truncate`, the whole variant on `title`) and the
  **quantity** keeps its room (`shrink-0`). Measured after: `scrollWidth` === `clientWidth` ===
  288, the text inside the border.
- **The name is the part that gives way, and that is a decision.** The variant is what decides
  which bottle leaves the shelf ("two of the 50 ml and one of the 100 ml") and the quantity is
  how many; the name is recoverable — it is the product's own name, and the hover carries it.
- The line is still one line per article: it is the line, not the detail screen, that says what
  the order is.

### A page change starts at the top

- The admin's `Pagination` (`components/admin/Ui.jsx`) asks the window for the top on a page
  change: `{ top: 0, left: 0, behavior: 'instant' }` — the same call the storefront's
  `Catalogue` and `Taxonomy` make. The panel had none of it, so a page change left the owner
  where the old list had them, reading the bottom of a list they had just left.
- **It lives in the paginator and not in each list.** The storefront's version watches a
  query-string write on the same pathname; the admin's page number is plain component state
  behind a debounced request, so there is nothing to watch — and one place fixes the orders,
  products, visits and waitlist lists at once.
- **The scroll is asked for on the click, not on the answer arriving.** The panel debounces its
  list request by 250ms, and waiting for the rows would leave the owner on the old offset for
  that long.

### An unavailable product keeps its colour

- The card faded the photograph of an unavailable product (`opacity-70 saturate-50`) — half
  drained of its colour and semi-transparent. The owner asked for the photographs in colour, and
  the fade is gone.
- **The band across the foot of the photo is what says the bottle cannot be bought.** That was
  already there (`bg-noir/85`, `product.outOfStock`), so the fact survives the change; what
  changes is that the perfume's own photography is no longer made to look like a bad
  photograph. The card's other two answers are untouched: no add-to-cart button, and the
  notify-me button in its place.
- This is the **listing** card (`components/ProductCard.jsx`), so it covers the home page, the
  catalogue, the brand and category pages and the wishlist at once. The product page's gallery
  was already in colour — nothing desaturated it there.
- The desaturation was deliberate when it was added (`b17533a`, *"Sold-out photos desaturate
  instead of only growing a bar"*), so the change is a decision reversed, not an oversight
  fixed. Worth saying plainly the next time the card is touched.

### Tests and the bundle

- New: `frontend/src/components/admin/Pagination.scroll.test.jsx` (4),
  `frontend/src/pages/admin/Orders.articles.test.jsx` (4), and a case in
  `ProductCard.soldout.test.jsx` for the colour. Suite now **142 frontend** (was 133).
- `frontend/dist` is committed and is what the deploy publishes, so the bundle was rebuilt
  (`npm run build`).

## Previous session (2026-11-03) — the home page's cache, and what it was really asking for

The owner asked whether the home page was optimized and whether a cache was in play. It was —
server-side, for the homepage payload, the shell and the bounds — but the home page's heaviest
read was in none of it.

- **The catalogue listing was uncached, and it is the home page's heaviest read.** The home page
  shows the whole catalogue under its hero (`<Catalogue mode="all" embedded />`), so every visit
  paid for a products query, a count query and four eager loads (translations, images, brand,
  categories). `CatalogService::paginate()` now caches it, keyed on the listing's *state* and not
  on its raw query: `catalog:listing:{locale}|{sort}|{perPage}|{page}`.
- **Only the catalogue's default view is cacheable** — no filter but the sort. A search term is
  whatever the shopper typed, a price bound is whatever they typed into a box, and a category or
  brand slug is not proved to exist by the request that carries it. Caching those is a key per
  thing a shopper tried: an unbounded key space, and one an attacker can fill on purpose. The
  bounded dimensions are the locale, the sort, the page size (`chamma.catalog.cacheable_per_page`
  — 12, and the 24 the storefront asks for) and the first ten pages
  (`chamma.catalog.cacheable_pages`). At most 300 keys can ever exist, which is what lets a flush
  enumerate the key space instead of guessing at it.
- **The paginator is rebuilt from the cached items, not cached whole.** A paginator carries the
  URLs of the page it was made for; one that came out of the cache with yesterday's query string
  would page a shopper into the wrong list. The rebuilt one takes its path and its query string
  from the request being answered.
- **The home payload lost the shelves it stopped showing.** `best_sellers`, `new_arrivals`,
  `offers` and `categories` were in `/api/{locale}/home` and the storefront read none of them —
  the shelves were replaced by the embedded catalogue. They cost three eager-loaded queries on
  every cache miss and a payload nobody looks at on every request.
- **An order no longer flushes the homepage.** Nothing in the payload moves when a bottle sells:
  the brand tiles and the delivery promises do not depend on stock. `OrderService::place()` now
  flushes the *listing* instead, which does read stock — and the featured sort, which reads
  `sales_count`. `OrderService` no longer depends on `HomeService` at all.
- **The rules behind the shelves stayed.** `CatalogService::bestSellers()`, `newArrivals()` and
  `onOffer()` are the shop's merchandising vocabulary — including the honest "nothing has sold
  yet, so the oldest products lead" fallback, which `sort=featured` does not implement. They have
  no production caller now; they are kept and tested directly, and `HomeShelvesTest` became
  `ProductShelvesTest` to match.
- **The suite now flushes the cache between tests** (`tests/TestCase.php`). The suite runs on the
  `array` store, which lives for the process rather than the test, so a cached listing from one
  test was still there for the next one while the database underneath it had been rolled back.
  Same bargain as `RefreshDatabase`: the database is rebuilt for every test, and so is the cache.
- `StorefrontCacheTest` grew the listing cases: the listing is cached, a cached listing is the
  same listing, a cached listing pages to the right place, an open-ended listing is not cached, a
  cached listing does not query the catalogue again, and a cached listing survives the cache
  store's serialisation (the `array` store the suite uses does not serialise, so that one is
  asserted directly). Suite now **325 backend / 1380 assertions**, **133 frontend**. Pint is clean
  on every file this session touched.

### Measured

- A cached listing entry is ~113 KB serialised for 24 products — the models carry every
  translation of every relation — against a 21 KB wire payload. A second read of a cached listing
  costs one query, the page view it counts; the first costs thirteen.

### Still open (deliberately)

- **ETag/304 on the API JSON.** Still no `Cache-Control` on any API endpoint, and still for the
  same reason: `TrackVisitor` counts a page view because the request arrives.
- **A client-side page cache.** The home payload, the shell and the listings are re-fetched on
  every mount; only the checkout options and the in-flight quote are shared in the browser.
- **The hero photograph.** `hero-desktop.jpg` is 344 KB and `hero-mobile.jpg` is 285 KB, un-hashed,
  with no `<link rel=preload>` and no `fetchpriority` on the `<picture>`. It is the LCP element
  and the largest asset on the page.
- **The admin bundle is not split.** No `React.lazy`: `dist/assets/index-*.js` is ~398 KB and
  carries every admin page.

## Previous session (2026-11-03) — listings that could not show all their products
The owner: *"when searching for a product or navigating to a brand's products like
/fr/brands/ibraq we cant see all products! are its missing the pagination"*. Two
separate bugs, one on each side of the API.
- **The search endpoint was not paginated at all.** `ProductController::search` answered
  with `?limit=8` and a bare collection — no `meta`, no `links` — so the search page
  could show eight rows and nothing else. It is now the catalogue with a term on it:
  `paginate()` over the same filter set, `q` (the storefront's name for the term)
  mapped onto the `search` filter. **The old `limit` parameter is gone**; search is a
  listing now.
- **The brand and category pages drew no page row.** The API has always paginated
  them; `Taxonomy.jsx` rendered the grid and stopped, so Ibraq's 21 products arrived
  as 12 rows and a second page that was in the answer and nowhere on the screen. The
  page number now rides `?page=` on those pages too, with a scroll to the top on the
  change (`ScrollToTop` cannot see it: it is a query-string write on the same pathname,
  the channel the filters use).
- **The page row is now one component** (`components/Pagination.jsx`), shared by the
  catalogue and the taxonomy pages. It reads the page number out of the API's own link
  URL (`https://api.chammastore.com/api/fr/brands/ibraq?page=2`) — the two hosts do
  not share URLs, and only the page number is worth keeping. It draws nothing when
  there is a single page: Laravel returns three links for a one-page paginator
  (Previous, "1", Next), and a row of dead arrows under a short list is noise.
- `per_page` is honoured by the brand, category, offers and search endpoints (they
  ignored it and used the shop default of 12, while the catalogue asked for 24).
  `Controller::perPage()` floors it at one: `paginate(0)` throws, and a bad number in
  a URL was a 500.
- New tests: `frontend/src/pages/Taxonomy.pagination.test.jsx` (6),
  `backend/tests/Feature/ListingPaginationTest.php` (7). Suites: **136 frontend**,
  **318 backend / 1321 assertions**.

### "Voir tout" named what it opens — frontend

The owner: *"'voir tout' on home page should be clair to the clients"*. The three home
page shelves each carried a "Voir tout" beside the heading, which told a visitor
nothing — "all" of what? Each link opens a different set (the whole shop, the new
arrivals, the offers), and the client had to guess.

- Three keys replace `home.viewAll` on the home page: `viewAllProducts` ("Voir tous les
  produits" / "عرض كل المنتجات" / "View all products"), `viewAllNew` ("Voir toutes les
  nouveautés" / "عرض كل المنتجات الجديدة" / "View all new arrivals") and `viewAllOffers`
  ("Voir toutes les offres" / "عرض كل العروض" / "View all offers"). **The old
  `home.viewAll` key is gone** — nothing reads it any more.
- The section heading row now wraps (`flex-wrap`, `gap-x-4 gap-y-2`): the labels are
  longer than "Voir tout" and would have squeezed the title on a phone.
- The same word was unclear in two other places and was fixed there too:
  `common.allProducts` ("Tous les produits") for the catalogue's first category-filter
  option — the absence of a filter, not a category — and `admin.allOrders` ("Toutes les
  commandes") for the dashboard's recent-orders link. Both used to borrow
  `home.viewAll`, which was a home-page key being used in two other places.
- Pinned in `Home.shelves.test.jsx`: the three links are three different labels, each
  pointing at its own listing, in every language.

### The home page shows the boutique — frontend `b852078`

The owner: *"can you replace section 'Les plus aimés'/'Fraîchement arrivés'/'Nos coups de
cœur' by the view in from the 'boutique'"*. The three shelves showed twelve products
between them and the rest of the shop was one menu item away.

- **The home page now renders the catalogue itself** — the whole list, with the
  filters, the sorting and the page row — not a link to it. It is the same
  `Catalogue` component the boutique page renders, embedded rather than linked, so
  the landing page *is* the shop and the page number still rides the URL.
- **`Catalogue` grew an `embedded` prop.** It brings its heading (an `h2`, because the
  hero owns the page's `h1`), its filters, its grid and its page row, and leaves the
  metadata alone.
- **`useSeo` grew an `enabled` flag** (`hooks/useSeo.js`). Two writers on the same
  `<head>` fight, and the loser's tags are the ones a crawler reads: the embedded
  catalogue would have replaced the home page's canonical with the boutique's.
- The product shelves, their "view all" links and their dictionary keys
  (`home.topSellers`, `home.newArrivals`, `home.offers`, `home.viewAll*`) are gone.
  `Home.shelves.test.jsx` is replaced by `Home.boutique.test.jsx` (4 tests).
- **Open thread: the home payload is 147 KB and 141 KB of it (96%) is the three
  shelves the page no longer renders.** The API still sends them — `HomeService` and
  `HomeShelvesTest` still build and pin them — so the landing page is paying for
  twelve products it does not show. Trimming the endpoint was not done: it changes a
  public API contract, and the shelves might be wanted again.

### The boutique was briefly the landing page, and was reverted

The owner first asked: *"can we make the boutique at the first page bcuz dump client
cant find all products"* — the catalogue at `/{locale}`, the home page moved to
`/{locale}/home`, `/{locale}/products` redirected, and every canonical, the nav and
the sitemap followed the move. That was **reverted in the same session**: *"no no back
to previous structure of / returns home page with all its section"*.

**`/{locale}` is the home page — hero, brand tiles, best sellers, new arrivals,
offers — and the catalogue is at `/{locale}/products`.** The nav leads with Accueil,
then Boutique, Offres, Nouveautés. Nothing about the routing, the canonicals, the
`index.html` canonical script or the sitemap changed from the boutique experiment, so
there is nothing to undo later; the pagination work above is the only thing that
survived it.

## Latest session (2026-10-30) — storefront request-waste quick wins

The owner approved five quick wins from a request-waste audit of the split-host deployment
(storefront chammastore.com, API api.chammastore.com). A further tier was discussed and
**deliberately deferred**: ETag/304 revalidation on API JSON, a client-side page cache,
React.lazy splitting of the admin bundle, sitemap/Google-feed caching, switching
CACHE_STORE, content-hashing the hero photographs.

Backend `5ebbfea` — *Cache the storefront read paths, and let browsers cache media and preflights*:

- **No HTTP Cache-Control on any API JSON endpoint — a standing rule, not an omission.**
  `TrackVisitor` counts page views because the requests arrive; a browser-cached `/home`
  would silently stop counting visits. Server-side (application-level) caching is the
  whole story.
- `HomeService` (new) assembles the whole `/home` payload and caches it per locale
  (`home:{locale}`, TTL 900s). Resources are `->resolve()`d to plain arrays **inside the
  cached closure** — an unresolved resource collection is not what you want to hand to the
  database cache driver's serializer. `flush()` loops every locale (a price change is a
  price change in every language — same reasoning as the navigation flush).
- `CatalogService::bounds()` is cached under one locale-independent key (`catalog:bounds`,
  900s) and gained `flush()`; the five-query assembly moved to a private `computeBounds()`.
- Flush wiring is **explicit, following the NavigationService pattern**, via a per-controller
  `flushStorefrontCaches()` helper (home + bounds together): Admin ProductController (all six
  write methods), Admin Brand/CategoryController (alongside the existing
  `$this->navigation->flush()`). `OrderService::place()` flushes home after the transaction —
  it is the one write outside the admin panel that moves stock, and flushing there rather
  than in its two callers means a future caller cannot forget it. **Orders do not flush
  bounds**: bounds read price and activity, not stock.
- `config/cors.php` `max_age` 0 → 86400: without it the browser repeated the OPTIONS round
  trip before every single API call. Pinned by `CorsTest::test_the_preflight_answer_is_cacheable`
  so it cannot silently return to zero.
- `backend/public/.htaccess` grants `Cache-Control: public, max-age=604800` to image files
  via `<FilesMatch>` (guarded on mod_headers). A week, matching nginx — **not** a year,
  because generated artwork is addressed by product slug and can reappear under a path it
  already occupied, and un-hashed names cannot be immutable.
- New `tests/Feature/StorefrontCacheTest.php` (5 tests). Suite now **311 tests / 1294
  assertions**. Pint now also reports pre-existing findings on
  `Admin/ProductController.php` (same rule as the others: verified with changes stashed,
  leave alone).

Frontend `c8412f4` — *Share the checkout requests, and warm the split-host connections*:

- `lib/api.js`: `checkoutOptions` shares one in-flight request per locale and reuses a
  settled answer for **five minutes**; a failure is deleted from the cache so a retry is a
  real retry. `quote` shares in-flight twins keyed `JSON.stringify([locale, body])` — which
  means bodies must be built with matching key order to hit the key. **A settled quote is
  never reused**: it is priced from live stock, and reusing it is how a sold-out bottle
  keeps looking purchasable. Both exist because `CartDrawer` (kept alive in `Layout` after
  the first add-to-cart) and the `Checkout` page each mount their own `useCheckoutForm`;
  form state stays independent on purpose — this shares requests, not state.
- `index.html`: an inline script preconnects to `%VITE_API_URL%` — two links, one plain
  (the no-cors image sockets) and one `crossorigin` (the credential-less fetch sockets).
  The `/^https?:\/\//` guard leaves Docker/dev builds with no link at all. In dist the
  value is baked at build time (`.env.production` → `https://api.chammastore.com`); a dist
  built with `VITE_API_URL` empty no-ops by design.
- `frontend/.htaccess` (source; the build copies it to dist) now carries the cache policies
  that previously existed only in nginx: `index.html` no-cache; `.js/.mjs/.css/.woff2`
  immutable for a year; images a week.
- `nginx.conf`: `/assets/` and `/images/` are now `^~` — **regex locations outrank plain
  prefixes**, and the new `location ~* \.(?:jpe?g|png|svg|webp|ico)$` (7d, for the un-hashed
  public artwork) would otherwise hijack hashed bundles and proxied artwork out of their own
  locations. A missing image now 404s instead of falling through to index.html.
- New `src/lib/api.checkout.test.js` (8 tests). Gotcha: the sharing caches are module-private
  Maps, so each test needs `vi.resetModules()` + a fresh `await import('./api')`. Suite now
  **130 tests / 21 files**.
- Rebuilt dist: `index-BYxSn9dO.js`, `.htaccess` survived, sitemap rebuilt. CSS hash is
  unchanged (`index-Ce5fB1iE.css`) — expected, no CSS was touched (see the `--pv` note below).

Left out of scope, noted for later: the `localStorage.getItem('chamma_admin_token') ??
localStorage.getItem('chamma_admin_token')` no-op fallback reads the same key twice (in
`lib/api.js` and again in `AdminContext.jsx`) — a legacy key the code no longer differs from,
harmless but dead.

## Latest session owner-requests (2026-10-17/18) — titles, faces, prices

These three were pushed together (`d07bf4d`/`8d4b87a`/`11ad449`). The owner first rejected a
bigger conversion pass (selling hero headline, trust strip, i18n CTA keys, Playfair) wholesale —
"not convinced", discarded with `git stash`/`git clean`. What the owner *did* want, in three steps:

### Soft, warm, assortment-covering home titles — frontend `d07bf4d`
- Final set (chosen after the owner said "softer", then "we sell body products too", then two
  earlier iterations were discarded):
  - Hero H1: « Parfums et soins, à votre image » / « عطور وعناية تليق بك » / "Perfumes and care
    that suit you". The old H1 was the hardcoded brand name "Chamma Store"; it stays hardcoded
    nowhere — the string lives in the new `home.heroTitle` i18n key.
  - shopByBrand: « Nos maisons de beauté » / (ar since 2026-10-18 « تسوّق حسب العلامة » — the
    literal « دور الجمال » was rejected) / "Our beauty houses" (was "Parfumez par marque").
  - topSellers: « Les plus aimés » / (ar « الأكثر رواجاً » — was « أجمل ما لدينا ») /
    "Most loved". newArrivals: « Fraîchement arrivés » / (ar « وصل حديثاً ») / "Freshly
    arrived". offers: « Nos coups de cœur » / (ar « العروض » — was « مفضّلاتنا », then
    briefly « عروض نحبها ») / "Our favourites".
  - These five keys are used by `Home.jsx` only. The discount message stays honest: the heading
    softened, the sale badges and struck prices still make the price cut obvious.
- `home.topSellers` etc. remained *factual* headings before; changing tone in one place only is
  therefore safe, but grep the key's call sites before re-softening any admin label.

### Title face: Rubik 300–900 variable — frontend (2026-10-18)
- Titles in **Rubik** at every weight on a variable axis — the commercial, rounded face
  the shop asked for ("softer, bolder, with radius"): a sans whose strokes carry a literal
  corner radius. Replaced the old `Amiri → Fraunces` serif stack everywhere `font-serif`
  is used; Arabic headings render from Rubik's own **arabic subset**, so Arabic no longer
  needs dedicated per-weight faces (Amiri shipped 400+700 for that reason once).
- **Self-hosted, three variable subsets** in `src/fonts.css` + `src/assets/fonts/`:
  `rubik-latin.woff2`, `rubik-latin-ext.woff2`, `rubik-arabic.woff2`, each declared
  `font-weight: 300 900` with the Google unicode-range split. Fetched from the css2
  endpoint (`family=Rubik:wght@300..900`, woff2-capable UA) — copy those woff2s if the
  faces ever need refreshing. Georgia remains the offline fallback in the
  `tailwind.config.js` serif stack.
- The invariant stands: **the base layer forces 700 on `h1–h6`/`.font-serif`, and the
  shipped faces must cover it or the browser synthesizes.** A variable face with the
  weight axis covers every interpolated weight, so 700 is always real.
- Corner radius accompanied the face: `index.css` base layer now defaults **`button` to a
  capsule (`border-radius:9999px`)** and **`input:not(checkbox,radio)/select/textarea` to
  `0.75rem`**; utilities outrank both. `<Link>`-styled-as-button spots needed explicit
  `rounded-full` (hero CTAs, AddToCartButton's link states, DrawerFooterLink), and image
  surfaces (ProductCard, product gallery, brand tiles) took `rounded-2xl`.

### Title faces (superseded): Fraunces + real-bold Amiri — frontend `8d4b87a`
- Latin titles: **Fraunces 700** (old-style, rounded, warm; suits the blush-rose palette), served
  as a **static instance pinned to `opsz=144`** from the css2 endpoint — the display-poster cut.
  A *variable* file would drift optical size per viewport; pinning keeps letterforms constant.
  `src/fonts.css` holds both latin and latin-ext subsets (ext covers œ and accented capitals).
- Arabic titles: Amiri's **real 700** face now ships. Before it, the base layer forced
  `font-weight:700` on `h1`–`h6`/`.font-serif` while only Amiri 400 existed, so Arabic headings
  rendered with *synthetic* bold — smeared at naskh sizes. Any future font change must respect
  the invariant: **every shipped face weight must cover the weights the base layer forces, or
  the browser will synthesize.**
- Stack: `Amiri → Fraunces → Georgia → …` (`tailwind.config.js`), resolved per glyph by
  unicode-range; Georgia stays purely as an offline fallback. Only `font-bold`/700 exists on the
  serif elements (grep `font-serif` — no `font-semibold` on serif type), so 400 Latin text never
  goes faux. Demoted faces (Playfair) were fully removed when discarded.

### Prices: Oswald 600 via `font-price` — frontend `8d4b87a`
- New Tailwind family `font-price`: `Oswald → system-sans fallback`, separate from `font-sans`
  on purpose: exactly one job, prices read as price tags. Only the **600** cut ships — the
  weight `Price.jsx` carries.
- `Price.jsx` puts `font-price font-semibold` on *the component itself*, not its callers:
  wishlist's call site sends no weight, and previously inherited body 400. Component-borne
  weight means every price is strong regardless of the caller.
- The struck-out old price and the `-%` pill sit inside the component, so they ride Oswald too —
  the whole pair is one promo message.
- **`Intl.NumberFormat('ar-MA')` emits Western (latn) digits** — Morocco config — so Latin
  subsets cover *all* locales' prices. Checkout summary rows, order pages and the admin panel
  stay system sans deliberately: data density, not promo.
- File placement quirk worth repeating: `fonts.css` blocks are fragile to `Edit` — one bulk edit
  accidentally replaced the Fraunces latin-ext block with the Oswald blocks and had to be
  restored by re-reading the file. The blocks are near-identical strings (same unicode-range
  text for several faces); append with unique context or re-read first.

## Layout

- `/Users/mahdi/chama-perfumes/backend` — Laravel. Git repo, branch `main`, clean, in sync with origin.
- `/Users/mahdi/chama-perfumes/frontend` — React + Vite + Tailwind 3.4.19. Git repo, branch `main`, clean, in sync with origin.
- `frontend/dist` is **tracked in git** and rebuilt on every frontend change, then committed.
- `frontend/dist/.htaccess` must survive the build (check it still exists after each build).

## Current state

- Backend `main`: `9489280` — *Cache the catalogue listing, and drop the shelves the home page stopped showing* (2026-11-03 session; see its section at the top)
- Frontend `main`: `5abdfb9` — *Trim the home page mocks to the payload the API actually sends*
- Backend `main`: `cb40d40` — *Page through every listing*
- Backend `main`: `5ebbfea` — *Cache the storefront read paths, and let browsers cache media and preflights* (2026-10-30 session; see its section at the top)
- Frontend `main`: `c8412f4` — *Share the checkout requests, and warm the split-host connections* (2026-10-30 session)
- Backend `main`: `ab4f3a3` — *Make the variant a required part of every order line*
- Backend `main`: `2d406ee` — *Show the oldest products when nothing has sold yet*
- Backend `main`: `292a0af` — *Repair waitlist schema for databases that predate the name column*
- Backend `main`: `d4342db` — *Drop the is_new flag and shrink the home shelves to four*
- Backend `main`: `3edef18` — *Let the owner record an order, and ask waitlist customers their name*
- Backend `main`: `ab3d462` — *Collect phone numbers for products that are out of stock*
- Frontend `main`: `11ad449` — *Rebuild the storefront bundle* (dist commit only)
- Frontend `main`: `8d4b87a` — *Set titles in warm faces, and prices in Oswald*
- Frontend `main`: `d07bf4d` — *Soften the home page titles*
- Frontend `main`: `217c98a` — *Open the mega sheet straight to its listings*
  (the desktop mega sheet dropped its `Marques`/`Catégories` heading and rule; the panel now
  opens directly on the item grid. The drawer's accordion sections keep their labels. Tests
  were 112/18 files at this point.)
- Frontend `main`: `ce5b3a9` — *Strengthen the muted text ramp* (see note on its message below)
- Frontend `main`: `72618c2` — *Scroll the home shelves sideways, and stop moving them on a desktop*
- Frontend `main`: `9d458c1` — *Add a name to the waitlist form and a way to record an order by hand*
- Frontend `main`: `cba4d09` — *Move the home carousel every 2.5 seconds*
- Frontend `main`: `98396c8` — *Let sold-out products collect a phone number*
- Frontend bundle: `dist/assets/index-BYxSn9dO.js`, `dist/assets/index-Ce5fB1iE.css`
  (2026-10-30; `.htaccess` survived, sitemap rebuilt)
  - Vite emits content-hashed filenames and **that is correct** — commit whatever
    `npm run build` produces, deletions included. `deploy_chamma.sh` does `rm -rf` on the
    staged tree and copies `dist/.` fresh, so old asset names must be *deleted*, not
    overwritten under their previous names and left behind unreferenced.
  - Earlier versions of this file instructed copying output over the existing
    filenames to "keep the bundle stable". That is wrong and was removed: the deploy
    replaces the whole tree, so a stale unreferenced bundle only wastes disk.
- Frontend has a test runner now: `npm test` (vitest + jsdom). Pinned to vitest 2.x
  because vitest 5 requires Vite 6+ and this app is on Vite 5 — upgrading Vite to
  accommodate a test runner would be the tail wagging the dog.
- Tailwind excludes `src/**/*.test.{js,jsx}` from its scan. Test files are prose, and
  the word "invisible" in a comment was enough to emit an unused rule into the bundle.
- The home brand carousel autoplays every **2500ms** (`Home.jsx`). The product-page gallery has
  **no** autoplay — a shopper is looking at those photographs.
  - `src/pages/Home.carousel.test.jsx` renders Home and measures the shipped cadence. This
    matters: `Carousel.autoplay.test.jsx` only proves the component honours whatever interval it
    is handed, and it stayed green while the page was still at 6000. The page-level test fails
    at 6000/4000/3000/1500.
  - Home's payload key is `brands`, and it filters those on a **truthy `logo`** — a brand with no
    image never reaches the carousel, so a mock without logos measures nothing and still passes.
  - **Only the brand carousel autoplays on every screen.** The three product shelves use
    `autoplayBelow`, which stops at `lg` (1024px) — four cards fill the row there anyway, so
    arrows never appear and motion would be the only thing moving. See `Carousel.jsx`.
- `seo.js` gotcha: `setLink` only rewrites an existing tag and silently no-ops otherwise;
  `ensureLink` matches on the `href` it is about to overwrite and so appends duplicates.
  Canonicals use `upsertLink` (match on `rel`, update in place). The hreflang tags remove-
  and-rebuild, which is why they never had this problem.
- Backend suite: **311 tests / 1294 assertions passing**. Frontend: 130 tests across 21 files.
- Backend Pint reports pre-existing findings on `lang/{fr,ar,en}/api.php`, `Product`,
  `ProductResource`, `StoreCatalogSeeder` and `Admin/ProductController.php`. They are
  pre-existing — they fail with local changes stashed — and are mass-rewrites of files not
  otherwise being touched. Left alone deliberately; do not "fix" them as drive-by.
  (`CatalogService` does **not** appear on this list any more: it was verified clean with
  `./vendor/bin/pint --test` in the 2026-10-30 session, before and after editing it.)
- Both working trees are clean and in sync with origin.

### Unverified in production
None of the commits above have been deployed. There is no SSH or browser access from
this environment, so the live smoke tests listed at the end of this file have not been run.

## Completed work

### Store tagline "Only original products" — frontend `bea4298`
- New i18n group `store.tagline`: fr « Uniquement des produits originaux », ar « منتجات أصلية فقط »,
  en "Only original products". Frontend-only; the backend has no part in it.
- Shown under the gold hairline in **all three lockups** — desktop header, mobile drawer, footer.
  The hairline stays the wordmark's underline, so the tagline reads as a second line of the mark.
- **Page titles**: `seo.homeTitle` was renamed to `seo.siteName`, now `Chamma Store — <tagline>`
  (ar: `متجر شاما — منتجات أصلية فقط`). Home uses it directly; every other page uses it as the
  ` | ` suffix in place of the old literal `Chamma Store`; `notFoundTitle` carries it too,
  as do `og:site_name` (in `useSeo`) and the static `index.html` title.
- `organisationJsonLd.name` is **left as plain "Chamma Store"** — that is the schema.org entity
  name, not a page title, so the tagline does not belong there.
- **The hero eyebrow was deliberately not changed.** The backend's `api.store.tagline`
  ("Perfumes and cosmetics"), which feeds the hero via `HomeController`, is a category
  descriptor, not this trust tagline; the owner's request named only the title and the lockups.
- Rebuilt `dist/` (`index-tODHxsOV.js`, `index-_p7ShiVh.css`); `.htaccess` survived.

### Header search on small screens — frontend `bea4298`
- The full-width `SearchBar` was **removed from the mobile drawer**; a magnifier button now sits
  in the header actions (`sm:hidden`) and toggles a full-width input in its own row under the
  bar (`#mobile-search`, also `sm:hidden`, in `Header.jsx`).
- From `sm` up nothing changes: the inline expanding input stays in the bar.
- `SearchBar` gained an `autoFocus` prop (the row mounts on demand, so the field focuses and the
  phone keyboard opens). The row closes on a route change (`location.pathname`) — the search
  navigates to `/{locale}/search?q=…`, a pathname change — and when the drawer opens.
- **Gotcha:** `vite build` empties `dist/`, so when the `fetch-sitemap.mjs` step then fails
  (network flake), it deletes the tracked `dist/sitemap.xml`. The build exits non-zero *after*
  Vite succeeded. `git checkout -- dist/sitemap.xml` restores the committed copy; the sitemap is
  otherwise unchanged by a header change.

### Product availability (independent of stock and publication)
- `products.is_available`, migration `2026_09_29_120000_add_is_available_to_products_table.php`.
- Separate admin endpoint, form controls, list action, dashboard totals, tests.
- Distinguishes "sold out" from "not published" — backend `e9d40da`.

### Multi-category products
- Migration `2026_09_29_140000_create_category_product_table.php`: `category_product` pivot,
  backfills from `products.category_id`, then drops that column. Rollback picks the lowest category id.
- `Product::categories()` / `Category::products()` are `BelongsToMany`.
- Admin takes `category_ids`; sync is guarded so legacy payloads without it don't wipe the pivot.
- Catalogue filtering and related products match on **any** shared category.
- Admin checkbox `MultiSelect`; product breadcrumb lists **all** categories.
- **Decision: no primary category.** Products list under every assigned category.
- Legacy `category` field kept as a compatibility alias containing the first category,
  so an old frontend bundle keeps working after the migration.
- Tests: `backend/tests/Feature/ProductCategoriesTest.php` (10 tests).

### Storefront header and drawer redesign — *user's original request*
Chosen direction: **editorial luxury**, keeping the existing overlay drawer.
- Serif `CHAMMA` wordmark over a gold hairline, replacing the logo image.
- Hairline top tier carrying the language switch (moved out of the main bar).
- Small-caps main nav.
- Full-width mega sheet under the header, portalled to `document.body`, built from data the
  navigation endpoint already returns: category photographs, brand taglines.
- Hover-driven with a 90ms open delay and 160ms close grace, so sweeping the cursor along
  the bar to reach a link no longer flashes every menu open in turn.
- Active page = gold hairline growing from the **inline-start** edge, so it grows from the
  right in Arabic.
- Drawer rebuilt on the same language: same lockup, serif nav rows, slide-in, staggered
  accordion sections. (It originally carried gold micro-cap section headings; those were
  removed in `dc7b258` — see below.)
- Superseded earlier passes `1184fcc` (sidebar redesign) and `4964b63` (border/type fix).

### Drawer brand/category rows — *user's original request*
- The two accordion triggers were the **only** drawer rows still on the gold micro-cap
  (`text-[10px] uppercase text-gold`), so on a small screen they read as a red annotation.
- They now carry the same serif type, weight, colour and hairline as every other row
  (`nav-link border-b border-stone-200/80 py-4 font-serif text-lg font-bold tracking-wide`).
- The divider moved from the section wrapper to the trigger, so every row shares one rule.
- Chevron de-golded: no filled rose chip, `border-stone-400 text-noir` when open.
- Child list indented `ps-4`. Desktop `MegaMenu` was left alone — it was already correct.

### Whole-site recolour to blush rose + cream — *user's original request*
Chosen direction: **blush rose on cream** (offered four; the others were mauve/lilac,
peach/nude, and a minimal soften-only pass).
- `gold` `#b8506b` → **`#c83c74`**, `ivory` `#ffffff` → `#fdf7f6`, `noir` `#3d1f2b` →
  `#3a1d27`, `plum` → `#804261`, `jade` → `#48793e`, and the whole `stone` ramp re-solved.
- **The old accent looked red because of hue, not saturation.** `#b8506b` is hue 344 —
  red-rose. `#c83c74` is hue **336** at the *same* lightness and saturation, which is what
  makes it read pink. Hold lightness constant when shifting hue; dropping it as well makes
  the site look heavier as well as pinker.
- `stone-50..300` are warm, not grey: a true grey next to a cream ground reads as a cold patch.
- `stone-400/500/600` clear AA on **both** `ivory` and white (some surfaces are still
  `bg-white` on purpose). 400 has 51 `text-stone-400` calls, so it is not decorative.
- **400 and 500 were later darkened** (`#986170`→`#7e515d`, `#8f5b69`→`#724853`) at the
  owner's request for stronger muted text, checkout especially. They had cleared AA *on white*
  (4.91:1 / 5.43:1) but fell to 4.35:1 / 4.81:1 on `stone-100`, which is where labels, hint
  copy and disabled states actually sit — a marginal fail on the surfaces that matter,
  invisible against the page background. Now 6.52:1 and 7.59:1 on white, 5.77:1 and 6.72:1
  on `stone-100`. Hue 344° and saturation 36% are unchanged, so the ramp is still one rose
  family. **Always compute contrast against the surface the text actually sits on, not
  against the page background** — checking only against white is what let this through.
- `gold` has to work three ways at once — link text on cream, white text on a `bg-gold` fill,
  and a hairline. It clears AA in all three (4.55 / 4.82).
- Four colour bypasses fixed: `accent-[#b8506b]` in Checkout, `rose-700` in `Price`, the
  discount badge in `ProductCard`, and `.rich-text a`. Plus `favicon.svg` and `theme-color`,
  which held the old hexes.
- 39 `bg-white` surfaces unified on `ivory`. `bg-white/90` (carousel arrow) and
  `border-white` (Home cards) stay — they sit over photographs.
- **Semantic reds stay red on purpose:** admin danger tones, checkout validation, out of stock.
  `jade` is likewise kept distinct from the pink.

### Logo
- `public/chamma-store-logo.png` (200×200, plum tones, transparent) was present but
  **unused** — header and footer both showed a plain `CHAMMA` wordmark.
- Now in the **footer** and the **mobile drawer**, at 56px / 44px, with intrinsic
  `width`/`height` to avoid layout shift. The desktop header keeps the serif lockup.
- The mark's colours are baked into the PNG, so it cannot follow a future palette change.

### Product card and footer
- **The product photography is shot on white. The page ground is white, and it must stay white.**
  A cream ground (`ivory: #fdf7f6`) was tried in `b17533a` and reverted in `facc403`: it framed
  every card's image in a visible white rectangle, and the photograph is the reason the card exists.
  This is the one visual decision here that is settled by the photography, not by taste.
- **The card is borderless. Do not put a frame, panel or scrim behind a product photo.**
  Interest comes from type: gold small-caps brand line warming on hover, `text-lg` serif name,
  and the header's own `nav-link` hairline under the title. A filled wishlist pill was rejected
  because it puts a panel back over the photo.
- The light end of the `stone` scale is **plain neutral grey**, and its warm variant was reverted
  alongside the cream ground — a rose tint on ~90 hairlines reads as a pink cast, and it was only
  ever justified as a companion to a cream ground. Each value keeps the lightness of the rose one
  it replaced, so no contrast ratio moved. 400 and darker stay rose: those are text, not surface.
- `overflow-hidden` on the card's image link clips the hover zoom. It is not load-bearing any more
  (no border to ride over), so unlike in `b17533a` it can be tidied freely — just don't move it onto
  a wrapper that also contains the text.
- Keep the two-line name clamp plus bottom-pinned price (`min-h-[2.75rem]`, `mt-auto`). The grid
  stretches cards but cannot align what varies inside them.
- **Footer mirrors the header rather than inventing a second look**: serif lockup over a gold
  hairline, the header's `text-[11px] tracking-[0.22em]` small-caps, and the mega sheet's serif
  heading with an `h-px flex-1` rule beside it. Footer links reuse `nav-link`.
- Footer columns read categories and brands from the **same `nav` context data** the mega sheet
  uses, so the footer cannot list a category the navigation lacks. The old footer was mislabelled —
  it headed Shop/Offers/Track-order with "Categories".
- New i18n key `footer.account` in all three locales. Reusing an unrelated key for a heading
  (e.g. `t('common','cart')`) is worse than adding the right one.

### Checking the emitted bundle
- Tailwind emits colours as `rgb(R G B / var(--tw-bg-opacity, 1))`, **not** `rgb(R G B)`. A check
  that greps for the closing-paren form fails on every colour and looks like a regression. Match the
  numbers only, or read the class body.
- **Verify logic in `src/`, not in the minified bundle.** Pattern-matching `className:"…"` or
  JSX attribute order in `dist/assets/*.js` produced three false failures in one sitting. Count
  occurrences of a class name, or read the source, which is authoritative.
- `@apply` in `index.css` emits a *declaration*, not a class name: `text-plum` never appears in the
  output CSS at all. To check a `@apply`'d colour, read the rule it landed in (e.g. `.rich-text a`).
- An absent class means it was purged, not that the colour is wrong: `border-stone-50` is missing
  simply because nothing uses it, while `bg-stone-50` has 12 uses. Confirm with a source grep
  before reporting a failure.

### Social links in the footer
- `socialUrl(network, value)` in `lib/api.js` builds every social link from a **bare handle**.
  Accepts a handle, an `@handle` or a whole profile URL; returns `''` for anything else so an
  unset env var yields no link rather than a dead `https://www.instagram.com/` button.
  A value containing a colon is rejected, so config cannot smuggle in a `javascript:`/`data:` URL.
- The footer's network list is **explicit, not mapped over the payload** — a network added to
  `StoreContactService` must not appear in the footer unreviewed. Facebook is deliberately absent.
- `contact` rides along in the `/navigation` bootstrap the shell already fetches once per locale,
  not in a new request, and not from the non-scoped `/store` route (whose `address` cannot be
  locale-dependent).
- Platform names are proper nouns and are **not** translated. Only the group's `aria-label` is
  (`footer.follow` = Nous suivre / تابعنا / Follow us).

### Orders WhatsApp contact button (2026-10-20)
- Every row in the admin orders list has **Contact on WhatsApp** next to "View", as a `wa.me` link
  **built server-side in `OrderResource.customer.whatsapp_url`** through
  `PhoneNumber::whatsappDigits` — the same shared normaliser `WaitlistEntry::whatsappUrl()` uses.
  Reason: wa.me needs bare international digits while the order stores the phone exactly as typed
  ("06 12 34 56 78", "+2126…", "00212…"), and `PhoneNumber` is the one place that decides which
  Moroccan shapes are dialable. The panel must not re-derive that normalisation in JS; it only
  renders what the resource produced, and renders **nothing** where it is null (a phone that does
  not match the Moroccan shape at all — a guard, since checkout and `StoreOrderRequest` validate
  every order's phone).
- **05-prefixed numbers keep their link** (`2125…`): the normaliser accepts the `[5-7]` shape and
  the admin panel does not re-ask. A number nobody registered on WhatsApp simply says so when the
  chat opens, which costs less than hiding the button for a range checkout itself accepts.
- Frontend: `Orders.jsx` actions cell is now a right-aligned flex; the link is ghost-styled
  (`buttonClass('ghost')`) with `SocialIcons.whatsapp` stroke glyph tinted `text-emerald-600`,
  `target="_blank" rel="noreferrer noopener"`. New i18n key `admin.contactWhatsapp`
  (fr/en 'WhatsApp', ar 'واتساب'). Regression suites: `Orders.contact.test.jsx` (2) on the panel,
  two tests in `AdminOrderCreationTest` on the contract digits.
- Deploy is **two-sided but graceful either way**: the old panel ignores the new JSON field, the
  old API leaves the new bundle without a link. Until both repos ship, the button is quietly
  absent rather than broken — but remember it, or the feature reads as "done" while invisible.

### Scroll reset on navigation
- **`ScrollToTop` in `App.jsx`, mounted in `LocaleShell` only.** This app uses `<Routes>`, not the
  data router, so React Router v6 does not touch scroll on navigation and there is no
  `ScrollRestoration`. Without it the browser carries the old offset onto the new page and clamps
  to the bottom when the new page is shorter — which is why opening a product or brand from a
  scrolled catalogue used to open at the bottom with the header out of sight.
- Keyed on **`location.key`** with a `pathname` + `useNavigationType()` guard, not on `pathname`
  alone. A pushed link aimed at the current query (the header's "Shop" clicked from a paginated
  catalogue) is a request to *be* on that page and must restart it; a same-pathname `REPLACE` is
  the catalogue's filter chips or the mobile sheet editing the list in place, and those must not
  yank the scroll — so `REPLACE` on the standing pathname is skipped and every push/pop resets.
- **Self-links scroll in `lib/scrollTop.js` (`scrollIfSelf`)**, not in `ScrollToTop`: React Router
  flattens a navigation whose destination equals the current `pathname` + `search` into an
  in-place replace — no push, no history entry, no new location — so no router subscriber can see
  it. The effect is a link that reads as broken: clicking the logo on a scrolled home page left
  the shopper exactly where they were. `scrollIfSelf` is composed into the logos, the main nav,
  the drawer's links, the wishlist/cart icons, the footer and the cart drawer's empty-state link.
- **The catalogue's pagination and sort are covered by `Catalogue` itself**, watching `page` and
  `sort` (both `replace` through `useSearchParams` on one pathname). `setParam` marks the key it
  wrote; a filter edit (chip, sheet, "clear all") suppresses the reset even though it also drops
  `page` back to 1, and the sheet's selects never scroll — the list filters live behind the panel
  and the offset is part of what the shopper is comparing. An unmarked change is `page` or `sort`
  and scrolls to the top with the same `{ top: 0, left: 0, behavior: 'instant' }` as `ScrollToTop`.
- It runs on mount as well as on a change. `index.html` turns the browser's own scroll restoration
  off, so there is no saved offset to fight; running here too is what guarantees a reload starts
  at the top on a browser that ignores that setting.
- Use `behavior: 'instant'`, not `'smooth'`: a tween between pages reads as lag, and it fights the
  carousel's own `scrollBy(..., 'smooth')`. Reset `left` as well as `top`.
- Keep it out of the admin tree — `admin/ProductEdit` and `Checkout` have their own deliberate
  scroll calls, and `ProductEditRoute` keys on the product id so form state is not carried across.

### Reuse `components/Carousel.jsx`, do not hand-roll a pager
- `Carousel` is dependency-free and already does scroll-snap, touch swipe, momentum, RTL
  scrolling, arrows, dots and `prefers-reduced-motion`. It is used by the home page's
  related-products rail, and the product gallery uses it too, so paging behaves identically
  in both places.
- Pass `perViewClass="[--pv:1]"` for a one-slide-per-page carousel; the arrow step and dot
  count are derived from `--pv`, so they follow the image count. The `--pv` classes are used
  bare, so they emit **no CSS** — a carousel-only change alters the JS hash but not the CSS
  hash. That is expected, not a stale build.
- Below two items, render a plain element instead. `Carousel` returns `null` for zero items
  and suppresses its controls for one, but it would still label a single slide
  `aria-roledescription="carousel"`, which is untrue.
- It renders every slide up front, so pass `loading={i === 0 ? 'eager' : 'lazy'}` when the
  first slide is the LCP element.
- New i18n key `product.gallery` (Galerie / معرض الصور / Gallery) labels the region and its dots.
  Arrow labels reuse the existing `common.prev` / `common.next`.

### Sale red
- `sale: '#d4211b'` is the **only** departure from the pink family, and it is for discounts only.
- The reason is saturation, not hue: `plum` (#804261) is 48% sat and read as mauve trim; `sale` is
  87% sat, which is what registers as red at 10px. Hue 2 vs the `gold` accent's 336 gives 334
  degrees of separation, so the two can never be confused.
- 5.21:1 on white, chosen over a brighter red's 4.83:1 because the badge is 10px bold and needs
  headroom for white text over a photograph.
- Applied to all three parts of the discount message — the card badge, the `-%` pill and the
  discounted price in `Price.jsx`. They are one message; splitting the colour read as a mistake.
- **`sale` on `bg-noir` is only 3.1:1.** All current call sites are light. Any dark surface needs a
  lighter step, not this one.
- `plum` still earns its place as the rich-text link colour in `index.css`, which is not a discount.

### Mega sheet fit and overflow
- **The sheet is `position: fixed` and full width, so content past the fold was
  unreachable, not merely hidden** — the page cannot scroll underneath it and the sheet
  did not scroll. Anything portalled and fixed needs its own height cap.
- Now capped to `calc(100vh - ${top}px)`, where `top` is the trigger's *measured* bottom,
  plus `overflow-y-auto overscroll-contain`. This scales with window height and taxonomy
  size instead of assuming a category count.
- Density: 4 columns, image frame `aspect-[4/3]` → fixed `h-24` letterbox, `py-6`, heading
  `text-xl`, names `text-base`, brands `text-[11px]`. Row 214px → 130px; 8 categories
  950px → 376px. The photograph is kept — a **fixed** height is what stops the image
  dictating the row height.
- Verify the arithmetic before claiming a panel fits: column width comes from
  `max-w-7xl` minus padding minus gaps, not from the viewport.

### Store tagline
- `api.store.tagline` (feeds the hero eyebrow via `HomeController`) is now
  `Parfums et cosmétiques` / `Perfumes and cosmetics` / `عطور ومستحضرات تجميل`.
- Translated per locale rather than pasting the English into all three.
- No test asserts this string.

### Back-in-stock waiting list — backend `ab3d462`, frontend `98396c8`
- Migration `2026_09_30_140000_create_waitlist_entries_table.php`. **Not yet run against MySQL.**
- **Name and phone, both required. No email.** The name was added later at the owner's request and
  deliberately supersedes the original phone-only decision: a bare number on a list is a dial string,
  and an owner working down it mid-shift cannot tell a regular from someone who called once, nor
  say who is on the line when it answers. `name` is in the *create* rather than a second migration
  only because this one has never run outside the test suite — it has no deployed copy to patch. If
  it ever is deployed, `name` becomes a normal add-column migration instead.
- Name is display data, **not** identity: uniqueness stays `(product_id, phone_normalised)`, and a
  duplicate signup updates the stored name along with the number. Changing a person's mind about
  who they are should not make them a second person.
- Two phone columns on purpose: `phone` keeps what the customer typed (so the panel shows a
  number they recognise) and `phone_normalised` is digits-only for the unique index and wa.me
  links. `PhoneNumber::normalise` handles `+212`, `00212`, `0`-prefixed and spaced input.
- Unique `(product_id, phone_normalised)`. Second signup **wins** — a corrected typo replaces the
  old number, and someone who was called and came back returns to the outstanding list.
- `WaitlistService::addPhone` catches `UniqueConstraintViolationException` only. Two requests can
  both read "no such entry" and both insert; the index rejects the loser, who then retries as an
  update. Catching the specific exception is deliberate: NOT NULL and FK failures must still
  surface rather than be reported as a successful signup for a row that was never written.
  Do not widen this to `QueryException`.
- Public `POST /api/{locale}/products/{slug}/waitlist`, rate limited 5/min/IP (`throttle:waitlist`).
  Locale comes from the URL, not the body — a body locale must not override the route.
  Only unavailable, active products accept signups. `201` new / `200` merged.
- Admin `GET/POST /api/admin/waitlist`, `PATCH /api/admin/waitlist/notified`, `auth:sanctum` + `admin`.
  **No delete endpoint anywhere** — a number here is a person who gave it, and a delete button
  would suggest the shop can erase that they were ever waiting. Products soft-delete, so the list
  survives with the product and returns on restore.
- Restock alert fires on the unavailable -> available edge only, from both `update()` and
  `toggleAvailability()`, so re-pricing an in-stock perfume does not re-mail the same numbers.
  Runs through `defer()`, `RestockNotifier` catches and logs everything so a mail failure cannot
  fail the admin's save, and the entries stay outstanding for the next restock.
- **Sending the alert deliberately does not mark anyone notified.** `notified_at` means the owner
  actually picked up the telephone. Marking on send would empty the calling list the moment the
  mail left.
- Reuses the order-alert recipients and toggle (`SettingService::ORDER_NOTIFICATION_*`). No
  separate waitlist settings.
- **Sold-out cards carry the "Me prévenir" button**, in the slot the add-to-cart button takes so
  a grid row of mixed availability keeps its alignment. It opens a *dialog*, never an inline
  expansion: the grid sizes every card in a row to the tallest, so an inline form would stretch
  all of them and undo the two-line name reservation.
  - `WaitlistForm` takes `compact` to drop its own title/intro when a dialog supplies a heading.
    The consent line stays in both.
  - The input id is `useId()`, **not a fixed string**. A product page renders this form and a
    related card's dialog can open over it; a shared `id="waitlist-phone"` made the dialog's
    `<label for>` point at the page's input. `src/components/WaitlistForm.test.jsx` pins it.
  - `src/pages/ProductCard.soldout.test.jsx` needs `// @vitest-environment jsdom`; the default
    vitest environment here is node.

### SEO and canonical URLs — backend `b36367b`, frontend `c99fded`, `0131f4c`
- `/api/sitemap.xml` covers products, categories and brands in all three locales with
  xhtml:link alternates. Cart, checkout, order and admin URLs are excluded.
- Canonical/alternate URLs are built from `chamma.storefront_url`, **not `APP_URL`** — the API
  runs on `api.chammastore.com` and the indexed pages live on `chammastore.com`.
- Frontend resources still emit relative `url` because that is what react-router links against.
- **`0131f4c` was a real bug fix.** `setCanonical` called `setLink`, which only rewrites an
  existing tag and returns silently otherwise; no canonical ships in `index.html`, so **no page
  in the shop ever emitted a canonical at all**. `ensureLink` was not the fix either — it matches
  on the `href` it is about to overwrite, so it appended a duplicate per navigation. Canonicals
  now use `upsertLink` (match on `rel`, update in place).
  - The bug was invisible: page, sitemap and API were all correct. `src/lib/seo.test.js` asserts
    the tags against the DOM; 4 of its 6 tests fail against the old `setLink` call.
- Do not use `chamaperfumes.ma` anywhere in SEO config.

### Orders typed in by the owner — backend `3edef18`, frontend `9d458c1`
- `POST /api/admin/orders` (`AdminOrderController::store`, `Admin\StoreOrderRequest`). Sits in the
  same `orders` table and the same list as a checkout order — deliberately **not** a separate
  "manual order" type, so the owner never has to remember which of two places a customer landed in.
- Goes through the existing `OrderService::place()`. The panel is trusted for *who the customer is*
  and for nothing else: price, stock, shipping fee, reference and name splitting are all
  re-computed server-side inside the transaction. Prices are not even sent by the form.
- **No order email on this path.** The owner's choice, and it is a real difference from checkout:
  the alert exists to say something happened while they were elsewhere, so a "new order" mail
  arriving seconds after they typed it reads as an order they did not take. Checkout still sends
  one — `test_checkout_still_sends_the_order_email` exists so the pair cannot be conflated later.
- `payment_status: 'paid'` is accepted at creation, for cash in hand or a cleared transfer. There
  is no later prompt to remember it by.
- City validated with `Rule::in(ShippingZoneService::names())`, exactly as checkout does, so the
  panel cannot offer a city checkout would reject. Note the values are the carrier's own spelling
  and are **upper case** (`CASABLANCA`), because that is what the config holds and what the city
  `<select>` sends. Do not "tidy" these to title case in tests.
- Admin `phone` was `max:30` string, deliberately **not** the storefront's `MoroccanPhone` rule.
  That rule exists to catch a customer mistyping a number; here the owner is transcribing someone
  on the phone, and rejecting `+212 6 12 34 56 78` would fail a deliverable order.
  **Reversed on 2026-11-04**: the number is now how a customer is found again, so it is reduced
  to the one form the shop agrees on and then held to the Moroccan rule — a number that cannot be
  reduced would file an order under a customer nobody will ever find. See the 2026-11-04 entry.
- Frontend: `NewOrderModal` inside `pages/admin/Orders.jsx`. Debounced product search, repeat adds
  merge into one quantity, server-side 422 reasons are shown verbatim rather than replaced with a
  generic failure.
- Fixed while in the file: `Orders.jsx` passed `page`/`lastPage`/`onChange` to `Pagination`, which
  takes `meta`/`onPage`. It rendered nothing, so orders past page 1 were unreachable in the panel.
- Two bugs the new-order test caught, both of which would have shipped broken:
  1. `NewOrderModal` destructured `call` but the call site never passed it — every save threw
     `call is not a function`.
  2. `set` was `(patch) => setDraft((d) => ({...d, ...patch}))` but the options effect called it
     with an **updater function**. Spreading a function contributes no own properties, so the
     payment-method default never applied. Invisible, because that `<select>` has no placeholder
     option: the DOM showed "cod" while React state held `""`, the owner saw a correct form, and
     every save came back 422. `set` now accepts both forms, like React's own `setState`.
     The `payment_method: 'cod'` assertion in `Orders.neworder.test.jsx` is the regression guard.

### Waiting list name column — backend `292a0af`
- **The `name` column was added by amending an already-deployed migration, and that broke
  production.** `name` went into `2026_09_30_140000_create_waitlist_entries_table.php` in place, on
  the reasoning that a migration which had only ever run in the test suite cannot have a deployed
  copy. That was wrong: the phone-only version of that migration shipped in `ab3d462` and *was*
  applied, so the `migrations` table recorded it and the edited file changed nothing on any real
  database. Code writing `name` to a table without it gave `no column named name` — a 500 on a form
  the customer had already filled in.
- `2026_09_30_170000_repair_waitlist_name_column.php` reconciles every state it can find: creates
  the table if it is absent (nothing was ever migrated), or adds `name` if the table is in its
  original phone-only shape. `down()` checks the `migrations` table to decide which of the two it
  has to undo, rather than assuming.
- The column is **nullable on purpose**. Rows predating it have no name, and both alternatives are
  worse: `NOT NULL` cannot be added over them, and a placeholder would put words in a customer's
  record that nobody typed. The admin panel renders a dash for those rows.
- **Lesson, worth keeping: never amend a migration that may have been applied. Add a new one.**
  `MEMORY.md` said this migration was "not yet run against MySQL" and that was true when written
  and false by the time the code reached a browser. Schema changes are the one thing a redeploy
  cannot undo.
- `WaitlistLegacySchemaTest` reproduces the deployed state (drops the column, runs the repair) and
  covers four cases: signup works afterwards, the repair is a no-op on a fresh install, it builds
  the table when entirely absent, and legacy rows stay nameless.

### Home shelves, `is_new` removed, and the best-sellers fallback — backend `d4342db`, `2d406ee`
- `is_new` is gone: column, model cast, both resources, the admin request and attributes, the
  storefront `?is_new=1` filter, the admin toggle, the table badge and the card's "Nouveau" ribbon.
  Dropped by `2026_09_30_160000_drop_products_is_new_column.php`, whose `down()` restores it
  defaulted to `false` rather than back-filling from `created_at` — the flag was advisory, so
  inventing a value would fabricate a decision nobody made.
- It never earned its keep: `scopeNewArrivals` OR'd the flag with `created_at >= now() - 45 days`,
  so a ticked-but-old product was excluded and a recent one qualified unticked. "New" is now just
  `created_at DESC`.
- **"Nouveautés" now points at `?sort=newest`** in the header, the footer and the `/new` redirect.
  `sort=newest` was already `created_at DESC`, so it is a rename, not a behaviour change. Catalogue
  titles that listing from the sort. `admin.isNew` and `admin.newFlag` were deleted rather than left
  orphaned — an unused translation key reads as a feature that still exists.
- Each home shelf holds **exactly four**, asserted against nine products so a limit drifting back to
  eight fails rather than passing because the shop holds fewer than eight.
- Shelves render as carousels (`ProductShelf` in `Home.jsx`), matching "Parfumez par marque".
  Autoplay below `lg` (1024px) only, via the new `Carousel` prop `autoplayBelow`; tracked through
  `matchMedia` so a rotation or a resized window takes effect immediately. Four cards fill the `lg`
  row exactly, so the arrows do not appear there anyway — layout and motion rule agree.
- **Best sellers fall back to oldest-first when the highest `sales_count` anywhere is 0.** A shop
  with no orders has no best sellers, and the old `orderByDesc` tie-break put the *newest* products
  under that heading, claiming the one thing they are not. Costs one `max()` per home request, which
  beats the conditional SQL an `ORDER BY CASE` would need.
- The `max()` is deliberately a **fresh `Product::query()->active()`**, not `(clone $q)`. `$q`
  already carries the shelf's eager loads, so cloning it would run those relations just to produce
  a scalar. One extra round trip beats three joined loads.
- **`sales_count` is not indexed** (plain `unsignedInteger` with default 0, never indexed in any
  migration), so that `max()` is a full scan of the products table on every home request. It is
  fine at catalogue scale and correct, but if this ever shows up in a slow-query log the fix is an
  index on `sales_count`, not restructuring the shelf.
- The `id` tie-break on all three shelves is **belt-and-braces, not a fix**. `HomeShelvesTest`
  documents that deleting it leaves the suite green: SQLite and InnoDB both already return ties
  id-descending, because secondary indexes carry the row id and the scan runs backwards. Kept
  because SQL guarantees no order among equal keys.
- **A closure passed to `shelf()` must `return` the builder.** Dropping the return made the whole
  `/api/fr/home` endpoint 500 — caught only because `HomeShelvesTest` hits the real endpoint rather
  than the service directly.

### Frontend `ce5b3a9` — its commit message is wrong, deliberately left alone
- The commit **content is correct**: `stone-400`/`stone-500` darkened, `Waitlist.jsx` dash for
  nameless rows, and the rebuilt `dist/`. Only the message is wrong — it carries the **backend**
  waitlist-migration text from an aborted heredoc, and describes two PHP migrations that live in
  the *other* repository.
- Left as-is on purpose. Rewriting it means an interactive rebase or a force-push over published
  history, to correct a comment that costs nothing but a reader's time and is already explained
  in the entries above. A wrong message is a smaller problem than rewriting pushed commits.
 - If it is ever worth fixing, the honest fix is `git rebase -i` with a reword, or `--force-with-
  lease` after an `amend` — and only once nobody has pulled. Do not do it casually.

### Other completed
- Store renamed to "Chamma Store" (backend `f19242f`).
- Free-shipping promotional text removed from the frontend; backend shipping behaviour untouched.
- Row `ActionMenu` on Products, Categories, Brands.
- `/admin/products/new` blank-state fixed with `emptyForm()`.
- Per-language product copy rendered as safe HTML (backend `7913a4e`).
- Fixed: `api.errors.checkout_failed` was referenced by the storefront 500 path but existed in no
  lang file, so a failed checkout showed the shopper a raw translation key. Added to fr/ar/en
  alongside the new `city_unknown`, `items_required`, `product_unknown`, `quantity_required`,
  `payment_method_unknown` and `order_create_failed`.

## Key decisions and constraints

- **Keep backwards compatibility across deploys.** The frontend is served as a static bundle
  from git, so the API keeps a singular `category` alias and guards the pivot sync.
- **Deployment order matters.** Run `php artisan migrate --force` *before* serving the new
  frontend, because the category migration drops `products.category_id`, and because the new
  sold-out form posts to a route whose table does not exist until it runs.
- Migrations are tested on SQLite `:memory:` and temporary SQLite files. The category
  backfill/rollback has **not** been exercised against the configured MySQL database.
- RTL support is deliberate: use logical CSS properties (`border-s-*`, `ps-*`, `me-*`).
  Never use bare `border-gold` / `border-transparent` for one-sided accents — those set all
  four sides. This exact bug shipped once and was fixed in `4964b63`.
- Palette: **blush rose on cream**, `gold: '#c83c74'` — see the recolour entry below.
  Fonts: Amiri/Georgia (`font-serif`), system sans.
- Locales: `fr`, `ar`, `en`.
- No visual/pixel testing available. Verify rendered markup and emitted CSS instead.
  There is now a DOM-level test runner (`npm test`), which covers headless logic like SEO tags
  but still cannot see a rendered page.
- **An assertion that passes is not evidence the code is right.** Confirm a new test fails
  against the old behaviour before trusting it. Two of the six SEO tests here were wrong on the
  first run and failed against correct code, which is how they were caught.
- `dist` hashed filenames must be committed as Vite emits them, deletions included. See the note
  under Current state; the old "keep the bundle stable" instruction was wrong.
- **The build is not a sufficient gate.** Vite does not catch undefined variables. After
  refactors, grep for every renamed constant/import to confirm each reference resolves.
- Tailwind 3.4.19 — do **not** use 4.x syntax (notably `outline-hidden`).
- The minifier rewrites `::after` to `:after`; grep for the wrong form and you will
  wrongly conclude a rule is missing.
- The minifier also rewrites **hex to `rgb(r g b / …)`** or to `#ffffffe6` for alpha, so
  grepping the built CSS for a hex often fails even when the rule is emitted correctly.
  Match on the class name instead, and expect several false alarms here.
- Vite compiles JSX props to an object (`width:"44"`), not `width="44"` — a grep for
  attribute syntax will miss real attributes.
- `index.css` forces `font-weight: 700` on `h1`–`h6` **and `.font-serif`** in `@layer base`.
  A `font-semibold` on a serif element does win, but `font-normal`/absent weight renders bold —
  check the base layer before concluding a row is the wrong weight.
- `text-gold` is blush pink, not gold, and the *name* is historical. Before changing the
  accent, check its **hue**: the previous value was hue 344, which is why it read as red.
- Contrast must be checked against **both** `ivory` and `bg-white` — a few surfaces are
  deliberately still white (anything floating over a photograph), so a token can pass on
  the page ground and fail on a card.
- Comments in this codebase are expected to describe real behaviour. Two comments described
  behaviour that wasn't implemented (mega outside-click, drawer timing) — fix the code or
  the comment, don't leave them apart.
- ESLint unavailable: the frontend has no `eslint.config.*`. `npm run build` is the current
  frontend gate. There is no test runner in the frontend either.
- **`Cookie::make()` has a nasty positional signature**: `($name, $value, $minutes, $path,
  $domain, $secure, $httpOnly, $raw, $sameSite)` — `$secure` comes *before* `$httpOnly`, and
  `$raw` sits between `$httpOnly` and `$sameSite`. `sameSite` must be the string `'lax'` or
  `null`; boolean `true` throws `InvalidArgumentException` from Symfony's validator. Because
  `TrackVisitor` wraps tracking in `try/catch` + `report()`, that exception was swallowed
  entirely — the visit was counted, the cookie was never sent, and every visitor looked new.
  **Use named arguments for `Cookie::make`.** If tracking silently stops working, read
  `storage/logs/laravel.log`, not the HTTP response.
- **Queued cookies need `AddQueuedCookiesToResponse`**, which the `api` middleware group does
  not include. `Cookie::queue()` inside the api stack is a no-op. Attach to the response with
  `$response->headers->setCookie($cookie)` instead.
- **`Request::path()` inside the api group returns the endpoint**, e.g. `api/fr/offers`, not the
  storefront page. The tracker strips the `api` prefix and the locale segment so the admin panel
  records which page a shopper actually saw.
- **The shared admin `<Pagination>` renders from `meta.links`**, not from `current_page`/`last_page`.
  A hand-rolled meta silently produces a page with no paging at all — no error, just no buttons.
  Spread `$page->toArray()` into the response. `Orders.jsx` used to make this same
  mistake — it passed `page`/`lastPage`/`onChange` to a component taking `meta`/`onPage`,
  so it rendered nothing and orders past page 1 were unreachable from the panel. Fixed in
  `9d458c1`, with a comment at the call site naming the trap. This bug is silent: no
  console error, just no buttons.
- In feature tests, `getJson()` only forwards cookies when `withCredentials()` has been called —
  `prepareCookiesForJsonRequest()` returns `[]` otherwise. Server-set cookies are *not* fed
  back into later requests automatically; only cookies the test sets explicitly are.

## To-do

Blocking:

1. **Run `php artisan migrate --force` in production.** Pending: the waiting list
   (`2026_09_30_140000`), visitor tracking (`2026_09_30_090000`), the `is_new` drop
   (`2026_09_30_160000`) and the waitlist repair (`2026_09_30_170000`). Until the waitlist ones
   run, the sold-out form 500s; until the visitor one, visits are silently not recorded. Local
   MySQL on port 3307 refused connections during the last session, so all of these were only ever
   exercised against SQLite.
   - `2026_09_30_170000` is the one that matters: it is what repairs a database that already ran
     the phone-only waitlist migration. **It must be run on every environment**, including any
     that already has a `waitlist_entries` table, or the name column stays missing and signups
     keep 500ing.
2. **Deploy.** Nothing above has been deployed — no SSH or browser access from this environment.

Needs the owner's decision:

3. `tel:` links alongside the existing `wa.me` links in the admin waitlist. WhatsApp-only was
   implemented; the original ask mentioned both.
   - Now slightly more urgent: a waitlist row can render as `—` in the name column
     (see the repair migration), and when the phone answers there is no name to say.
4. Whether a restock alert should also fire when only `stock` moves 0 -> positive while
   `is_available` stays true. Currently the trigger follows `in_stock`, which reads
   `is_available`, so stock-only movement does not alert.
5. Privacy wording for visitor tracking (IP, user agent, referrer, path). The code comment
   asserts first-party cookies are exempt from consent banners — that is a legal call, not a
   code fact, and the owner's to publish.
6. Production SMTP. Recipient was saved as `mehdi.ouqas1999@gmail.com` with the toggle
   **disabled**, and no order alert ever arrived. Both order and restock alerts depend on it.
7. **Rotate the exposed credentials.** Anything pasted into chat must be considered public.
   Give the mailbox a dedicated app password, not the account password.
8. Submit the sitemap in Search Console; needs owner access.

Never verified by eye (no browser access):

9. The waiting list form on a sold-out product, and the admin waitlist page — both now also ask
   for a **name**, so the two-field layout has never been seen rendered. In a card dialog the
   form is now two inputs in a 24rem box; check it is not cramped.
10. The admin "New order" modal (`/admin/orders` -> *New order*). Never opened in a browser:
   the product-search dropdown, the item rows, and the payment/city selects are all unverified
   visually. The unit tests drive it, but not its layout.
11. Everything from earlier sessions still unverified: visits page, card, drawer order, mega
    sheet, footer, hover timings, drawer slide, and the three social glyphs.
12. **The darkened muted text, checkout especially.** 11 `text-stone-400` calls live on
    Checkout, and the old values only failed against `stone-100`, never against white — so
    this looks correct in a screenshot of an empty page and wrong on a real label. Read the
    labels, field hints and disabled buttons, not just the body copy.
13. **The four product shelves as carousels, and that they hold still on a desktop.** Check at
    ~500px (scrolls, autoplays), at ~1100px (four across, arrows gone, no autoplay) and at a
    narrow phone width. Also confirm the "Nouveautés" links land on `?sort=newest`.

Also outstanding:

14. The logo PNG has baked-in colours; if the palette moves the mark will not follow.

## Verification commands

```sh
# frontend
cd /Users/mahdi/chama-perfumes/frontend && npm test      # vitest + jsdom, 130 tests / 21 files
npm run build && ls dist/.htaccess      # .htaccess must survive the build
git status --short dist/                # old hashed assets must show as deleted

# backend
cd /Users/mahdi/chama-perfumes/backend && php artisan test        # 311 tests / 1294 assertions
./vendor/bin/pint --test app/Services/WaitlistService.php app/Models/WaitlistEntry.php \
  app/Support/PhoneNumber.php app/Services/RestockNotifier.php app/Services/WaitlistEntryService.php \
  app/Mail/ProductRestockedNotification.php app/Http/Requests/StoreWaitlistRequest.php \
  app/Http/Controllers/Api/V1/WaitlistController.php \
  app/Http/Controllers/Api/V1/Admin/WaitlistController.php \
  app/Http/Requests/Admin/StoreOrderRequest.php \
  tests/Feature/HomeShelvesTest.php tests/Feature/WaitlistLegacySchemaTest.php \
  database/migrations/2026_09_30_160000_drop_products_is_new_column.php \
  database/migrations/2026_09_30_170000_repair_waitlist_name_column.php \
  app/Http/Controllers/Api/V1/Admin/OrderController.php \
  tests/Feature/WaitlistTest.php tests/Feature/AdminOrderCreationTest.php \
  database/migrations/2026_09_30_140000_create_waitlist_entries_table.php

# migrations run in this session were SQLite-only
DB_CONNECTION=sqlite DB_DATABASE=/tmp/opencode/wl.sqlite php artisan migrate --force
```

Pint reports pre-existing `single_quote` findings in `lang/{fr,ar,en}/api.php`. They are not new
and should not be "fixed" as part of an unrelated commit.
