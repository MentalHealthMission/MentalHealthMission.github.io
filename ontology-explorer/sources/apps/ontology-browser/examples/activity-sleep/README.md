# Activity and sleep study

All records, participants, identifiers, dates, tables and device names are
handwritten fiction. There is no real CONNECT, REDCap, instrument or Research
Data Store schema here. The four tables deliberately use different field names.

## Identity and ownership

The example study is a local individual, not a new public Study class. Local
`study` assertions and explicit (table, source-code) identity assignments scope
every association to this fictional study. IDs are not joined by spelling or
assumed unique outside their source table. Participant 01 uses P01/S-01/N01/D01;
Participant 02 uses P02/S-02/N02/D02.

## Activity windows and units

All activity timestamps are explicit UTC; intervals include their start and
exclude their end. Stride's `steps_in_window` is an integer count, not a running
counter. DayMove's `step_total` is a separately reported total for a UTC calendar
day. These are independent device records and are never added together.

The only daily derivation is deliberately limited to 3 February 2025: two exact
windows [00:00,12:00) and [12:00,next 00:00), with no additional interval for that
participant/day, contribute 1,200 + 2,300 = 3,500 steps for Participant 01.
Participant 02 has only an 800-step half-day interval, so no daily result is
derived. The comparability SELECT can sum supplied intervals but explicitly
labels incomplete coverage. It does not turn 800 into a daily step count.

Numeric quantities use QUDT `quantityValue`/`numericValue`; deprecated
measurement-domain `hasValue`/`hasUnit` are not used for observations or features.
QUDT `unit` links to named example-local unit pages for steps and minutes. The source records and
interval end/result time are retained through the semantic observation pages.
Local `start` and `end` are presentation simplifications in this example, not a
claim that ODIM-MH lacks time semantics: the catalogue also defines
`occursDuring`, `ObservationContext`, `hasStartTime` and `hasEndTime`.
The result's native `wasComputedBy` links to a fictional instance of
`StepCountAggregationComputation`; native `hasMeasurement` identifies inputs.

## Sleep and response interpretation

`night_date` and `night_began` identify the UTC calendar date on which a reference
night began; neither asserts a submission or observation result timestamp.
NightRest supplies device-estimated durations in minutes. The local
`quantityMeaning` value `estimated-sleep-duration` describes this fictional
quantity; it is not an existing ODIM-MH observable property or a new ontology
claim. Missing duration or step values remain missing, never zero.

The generic diary asks, “How many hours do you think you slept last night?”
`answersQuestion` links each response to the fictional `Question` individual;
`hasResponseValue` retains the original string. Responses remain `ResponseItem`
individuals, not sensor `Measurement` individuals. Native `wasReportedBy` links
to the fictional participant; study ownership and reference night use explicitly
example-local properties.
There is no existing standard response-to-self-reported-measurement bridge.

Only the comparison SELECT interprets these numeric hour strings and multiplies
by 60. It reports 450 versus 420 minutes for Participant 01, a difference of
30 minutes. Participant 02 reports 360 minutes but has no device-estimated value,
so no estimated duration or difference is fabricated. No scientific equivalence,
diagnosis, sensor validation or universal response conversion follows.

## Executed evidence

Five ordered CONSTRUCT files map the four original tables and the bounded daily
result. Five SELECT files answer available sleep information, steps across both
sources, interval-vs-daily comparability, reported-vs-estimated sleep, and the
concrete activity derivation. Results are computed, not authored answer tables.
The build performs no RDFS/OWL reasoning and does not alter source records.
All original Turtle/profile/SPARQL bytes and the mapped N-Triples are downloadable
from Technical details. Rendering shows empty arrays for missing table cells and
retains multivalued notes. No RDS, S3, network query or protected record is read.
