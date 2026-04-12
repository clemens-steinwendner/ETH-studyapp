-- ETH Computer Networks Course — Standard Schema (FR-19)
-- Network topology and packet data for SQL exercises.

CREATE TABLE Routers (
    router_id    INTEGER PRIMARY KEY,
    hostname     VARCHAR(100) NOT NULL,
    ip_address   VARCHAR(15) NOT NULL,
    as_number    INTEGER
);

CREATE TABLE Links (
    link_id      INTEGER PRIMARY KEY,
    router_a     INTEGER REFERENCES Routers(router_id),
    router_b     INTEGER REFERENCES Routers(router_id),
    bandwidth_mbps INTEGER,
    latency_ms   DECIMAL(6,2)
);

CREATE TABLE Packets (
    packet_id    INTEGER PRIMARY KEY,
    src_ip       VARCHAR(15),
    dst_ip       VARCHAR(15),
    protocol     VARCHAR(10),
    size_bytes   INTEGER,
    timestamp    TIMESTAMP
);

CREATE TABLE BGPRoutes (
    router_id    INTEGER REFERENCES Routers(router_id),
    prefix       VARCHAR(20),
    next_hop     VARCHAR(15),
    as_path      VARCHAR(200),
    local_pref   INTEGER,
    PRIMARY KEY (router_id, prefix)
);

-- Sample data
INSERT INTO Routers VALUES
    (1, 'r1.ethz.ch', '192.168.1.1', 559),
    (2, 'r2.ethz.ch', '192.168.1.2', 559),
    (3, 'r3.switch.ch','192.168.2.1', 4900);

INSERT INTO Links VALUES
    (1, 1, 2, 10000, 0.5),
    (2, 2, 3,  1000, 2.1);

INSERT INTO BGPRoutes VALUES
    (1, '192.0.2.0/24', '192.168.1.2', '559 4900', 100),
    (2, '192.0.2.0/24', '192.168.2.1', '4900', 100);
