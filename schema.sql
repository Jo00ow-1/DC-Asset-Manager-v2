--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Homebrew)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id integer NOT NULL,
    category character varying(20) NOT NULL,
    vendor character varying(20) NOT NULL,
    spec character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(20) NOT NULL
);


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: monthly_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_inspections (
    id integer NOT NULL,
    year_month character varying(7) NOT NULL,
    location_id integer,
    is_completed boolean DEFAULT false,
    completed_by character varying(50),
    completed_at timestamp without time zone
);


--
-- Name: monthly_inspections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_inspections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_inspections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_inspections_id_seq OWNED BY public.monthly_inspections.id;


--
-- Name: stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock (
    id integer NOT NULL,
    item_id integer,
    location_id integer,
    quantity integer DEFAULT 0 NOT NULL,
    updated_by character varying(50),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_id_seq OWNED BY public.stock.id;


--
-- Name: stock_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_logs (
    id integer NOT NULL,
    location_id integer,
    item_id integer,
    type character varying(10) NOT NULL,
    change_qty integer NOT NULL,
    result_qty integer NOT NULL,
    updated_by character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    requester character varying(50)
);


--
-- Name: stock_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_logs_id_seq OWNED BY public.stock_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: monthly_inspections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_inspections ALTER COLUMN id SET DEFAULT nextval('public.monthly_inspections_id_seq'::regclass);


--
-- Name: stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock ALTER COLUMN id SET DEFAULT nextval('public.stock_id_seq'::regclass);


--
-- Name: stock_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_logs ALTER COLUMN id SET DEFAULT nextval('public.stock_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: monthly_inspections monthly_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_inspections
    ADD CONSTRAINT monthly_inspections_pkey PRIMARY KEY (id);


--
-- Name: monthly_inspections monthly_inspections_year_month_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_inspections
    ADD CONSTRAINT monthly_inspections_year_month_location_id_key UNIQUE (year_month, location_id);


--
-- Name: stock stock_item_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_item_id_location_id_key UNIQUE (item_id, location_id);


--
-- Name: stock_logs stock_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_logs
    ADD CONSTRAINT stock_logs_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: monthly_inspections monthly_inspections_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_inspections
    ADD CONSTRAINT monthly_inspections_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: stock stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: stock stock_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: stock_logs stock_logs_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_logs
    ADD CONSTRAINT stock_logs_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: stock_logs stock_logs_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_logs
    ADD CONSTRAINT stock_logs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- PostgreSQL database dump complete
--


