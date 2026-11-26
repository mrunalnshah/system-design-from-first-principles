---
description: "How TCP turns lost packets into a reliable stream."
epigraph: "Everything is a trade-off."
epigraph_source: "Anonymous"
---
Packets get lost. TCP hides that.[^1]

# Retransmission
A sender waits about one round trip before sending again:

$$
\text{timeout} = \text{smoothed round-trip time} + 4 \times \text{round-trip variation} + \text{a safety margin for slow links}
$$

[^1]: Mostly: a long enough outage still breaks the connection.
